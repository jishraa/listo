import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, ChevronDown } from 'lucide-react'
import { useListsStore } from '../../store/useListsStore'
import { useMemoryStore, memoryKey, regularsOf, suggestOf, type MemoryItem } from '../../store/useMemoryStore'
import { detectCategoryIn, parseItemInput, GROCERY_VOCAB } from '../../lib/constants'
import { findPendingMergeTarget, hasCompletedMatch } from '../../lib/duplicates'
import { capitalize, formatQuantity } from '../../lib/utils'
import CategoryPickerSheet from './CategoryPickerSheet'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

// The Add Item bottom sheet (extracted from ListDetail): smart quantity
// parsing, category auto-detect, GROCERY_VOCAB suggestions, frequent-item
// one-tap chips, the "✓ added" confirmation, and the duplicate-merge
// confirm. Rapid entry: adding clears the field and keeps the keyboard open.

// Split the encoded qty ("×2", "2kg", "500g", "1.5L") into number + unit for
// display. Returns null when there's nothing to show.
function describeQty(qty: string): { quantity: string; unit: string } | null {
  if (!qty) return null
  const m = qty.match(/^×?(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/)
  if (!m) return null
  return { quantity: m[1], unit: m[2] || '' }
}

// "Milk · 2" / "Rice · 2 kg" / "Milk" — never the × symbol (spec §confirmation).
// Uses the shared formatQuantity util so display is consistent app-wide.
function formatItemLabel(title: string, qty: string): string {
  const q = formatQuantity(qty)
  return q ? `${title} · ${q}` : title
}

function mergeQuantities(a: string | null | undefined, b: string): string {
  if (!a) return b
  const parse = (s: string) => {
    const m = s.trim().replace(/\s+/g, '').match(/^([×x])?(\d+(?:\.\d+)?)([a-zA-Z]*)$/)
    if (!m) return null
    return { cross: !!m[1], num: parseFloat(m[2]), unit: m[3].toLowerCase() }
  }
  const pa = parse(a), pb = parse(b)
  if (!pa || !pb) return `${a}+${b}`
  const sum = pa.num + pb.num
  return `${(pa.cross || pb.cross) ? '×' : ''}${Number.isInteger(sum) ? sum : sum.toFixed(1)}${pa.unit || pb.unit}`
}

interface Props {
  open: boolean
  onClose: () => void
  list: List
  items: ListItem[]
  cats: ListCategory[]
}

export default function AddItemSheet({ open, onClose, list, items, cats }: Props) {
  const store = useListsStore()
  const [input,      setInput]      = useState('')
  const [category,   setCategory]   = useState<string | null>(null)
  const [catSticky,  setCatSticky]  = useState(false)
  const [flashing,   setFlashing]   = useState(false)
  const [showMerge,  setShowMerge]  = useState(false)
  const [mergeTarget, setMergeTarget] = useState<ListItem | null>(null)
  const [pendingAdd, setPendingAdd] = useState<{ title: string; qty: string; category: string | null } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Transient "✓ added" confirmation ("repeat" adds a "previously purchased" note)
  const [addedToast, setAddedToast] = useState<string | null>(null)
  const [addedRepeat, setAddedRepeat] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flashAddedToast(title: string, repeat = false) {
    setAddedToast(title)
    setAddedRepeat(repeat)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    // ~1.8s for a normal add, then it fades and Your Regulars take over; the
    // repeat note lingers a little longer since it carries more to read.
    toastTimer.current = setTimeout(() => setAddedToast(null), repeat ? 3000 : 1800)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // Focus the field whenever the sheet opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])
  const parsedInput = useMemo(() => parseItemInput(input), [input])

  // Auto-detect category from the typed item (debounced)
  useEffect(() => {
    if (!open || catSticky) return
    const { item } = parseItemInput(input)
    if (!item) { setCategory(null); return }
    const t = setTimeout(() => {
      const detected = detectCategoryIn(cats, item)
      if (detected) setCategory(detected)
    }, 250)
    return () => clearTimeout(t)
  }, [input, open, catSticky, cats])

  // List Memory drives both surfaces below. Subscribe to history so they stay
  // reactive as the user adds items.
  const memHistory = useMemoryStore(s => s.history)
  const excludeKeys = useMemo(
    () => new Set(items.filter(i => !i.completed).map(i => memoryKey(i.title))),
    [items],
  )

  // Type-ahead: the user's own history first (with usual quantity), then the
  // generic grocery vocab for anything they haven't bought before.
  const suggestions = useMemo(() => {
    const q = parsedInput.item
    if (q.trim().length < 2) return []
    const mem = suggestOf(memHistory, q, excludeKeys, 5)
    const memKeys = new Set(mem.map(m => m.nameKey))
    const toEntry = (m: MemoryItem) => {
      const fill = m.lastQuantity ? `${m.name} ${m.lastQuantity}` : m.name
      return { key: `m:${m.nameKey}`, label: fill, fill }
    }
    const ql = q.toLowerCase()
    const pool = list.type === 'shopping' ? GROCERY_VOCAB : []
    const vocab = pool
      .filter(t => t.toLowerCase().startsWith(ql) && t.toLowerCase() !== ql && !memKeys.has(memoryKey(t)))
      .slice(0, Math.max(0, 5 - mem.length))
      .map(t => ({ key: `v:${t}`, label: t, fill: t }))
    return [...mem.map(toEntry), ...vocab]
  }, [parsedInput, list.type, excludeKeys, memHistory])

  // "Your regulars" — one-tap add chips (with usual quantity) from history,
  // shown while the field is empty. Falls back to current-list frequency for
  // users who have no server history yet.
  const regulars = useMemo<MemoryItem[]>(() => {
    const mem = regularsOf(memHistory, excludeKeys, 6)
    if (mem.length > 0) return mem
    const counts = new Map<string, { name: string; n: number }>()
    Object.values(store.items).flat().forEach(i => {
      const k = memoryKey(i.title)
      if (!k) return
      const e = counts.get(k) ?? { name: capitalize(i.title.trim()), n: 0 }
      e.n++; counts.set(k, e)
    })
    return [...counts.entries()]
      .filter(([k, v]) => v.n >= 2 && !excludeKeys.has(k))
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 6)
      .map(([k, v]) => ({ nameKey: k, name: v.name, category: null, lastQuantity: null, count: v.n }))
  }, [memHistory, store.items, excludeKeys])

  function resetAdd() {
    setInput(''); setCategory(null); setCatSticky(false)
    setShowMerge(false); setMergeTarget(null); setPendingAdd(null)
  }

  async function handleAdd() {
    const parsed = parseItemInput(input)
    const t = capitalize(parsed.item)
    const qty = parsed.qty
    if (!t) return
    const finalCat = catSticky ? category : (category ?? detectCategoryIn(cats, t))
    // Blocking merge only against a PENDING item that already has a quantity
    // (scenario 2). Completed items never trigger this (repeat purchase).
    if (qty) {
      const existing = findPendingMergeTarget(items, t)
      if (existing) {
        setPendingAdd({ title: t, qty, category: finalCat ?? null })
        setMergeTarget(existing); setShowMerge(true); return
      }
    }
    // A completed item with this name = repeat purchase → add as new pending,
    // no review, and note it in the confirmation.
    const repeat = hasCompletedMatch(items, t)
    resetAdd(); setFlashing(true)
    await store.addItem(list.id, t, qty, finalCat ?? null)
    setFlashing(false)
    flashAddedToast(formatItemLabel(t, qty), repeat)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  async function handleMerge() {
    if (!mergeTarget || !pendingAdd) return
    const combined = mergeQuantities(mergeTarget.quantity, pendingAdd.qty)
    setShowMerge(false); setMergeTarget(null); resetAdd()
    await store.updateItem(list.id, mergeTarget.id, { title: mergeTarget.title, quantity: combined, category: mergeTarget.category })
    setPendingAdd(null)
  }

  async function addRegular(m: MemoryItem) {
    const cat = m.category ?? detectCategoryIn(cats, m.name) ?? null
    await store.addItem(list.id, m.name, m.lastQuantity ?? '', cat)
    flashAddedToast(formatItemLabel(m.name, m.lastQuantity ?? ''))
    inputRef.current?.focus()
  }

  const currentCat = category ? catById.get(category) : null
  const qtyInfo = describeQty(parsedInput.qty)

  return (
    <>
      {open && (
        <>
          <div className="sheet-overlay" onClick={() => { resetAdd(); onClose() }} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Add to {list.name}</p>
              </div>
              <div style={{ position: 'relative' }}>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    aria-label={`Add item to ${list.name}`}
                    placeholder={list.type === 'shopping' ? 'Add item… e.g. Milk 2L or Rice 5kg' : 'Add an item…'}
                    maxLength={200}
                    autoComplete="off"
                    enterKeyHint="done"
                    style={{
                      flex: 1, height: 48, borderRadius: 10, padding: '0 14px',
                      background: 'var(--bg-input)', border: '1.5px solid transparent',
                      color: 'var(--text)', fontSize: 15, outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!parsedInput.item || flashing}
                    aria-label="Add item"
                    aria-disabled={!parsedInput.item || flashing}
                    style={{
                      flexShrink: 0, width: 48, height: 48, borderRadius: 10, border: 'none',
                      background: parsedInput.item ? 'var(--accent)' : 'var(--bg-input)',
                      color: parsedInput.item ? '#fff' : 'var(--text-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: parsedInput.item && !flashing ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  ><Plus size={22} /></button>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 52, zIndex: 10,
                    background: 'var(--bg-card)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: 10, boxShadow: 'var(--shadow)',
                    border: '1px solid var(--border)', marginTop: 4,
                  }}>
                    {suggestions.map(s => (
                      <button key={s.key} onClick={() => { setInput(s.fill); inputRef.current?.focus() }}
                        style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* "✓ added" confirmation — directly below the input, close to the
                  action that triggered it; auto-hides after ~2s (spec §2.1) */}
              {addedToast && (
                <span className="list-fade-in" role="status" aria-live="polite" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                  padding: '4px 2px', color: 'var(--accent)', fontSize: 13, fontWeight: 600,
                }}>
                  <Check size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {addedToast} added{addedRepeat && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · previously purchased</span>}
                  </span>
                </span>
              )}

              {/* Your regulars — one-tap add (with usual quantity) while empty */}
              {!input && regulars.length > 0 && (
                <div className="list-fade-in">
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                    Your regulars
                  </p>
                  {/* Single scrolling row — never a crowded wrap (spec §Your Regulars) */}
                  <div className="hscroll" role="list" aria-label="Your regulars" style={{ margin: '0 -16px', padding: '0 16px 2px' }}>
                    {regulars.map(m => {
                      const q = formatQuantity(m.lastQuantity)
                      return (
                        <button
                          key={m.nameKey}
                          role="listitem"
                          onClick={() => addRegular(m)}
                          aria-label={`Add ${m.name}${q ? ` ${q}` : ''}`}
                          style={{
                            flexShrink: 0, height: 40, padding: '0 14px', borderRadius: 20, cursor: 'pointer',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap',
                          }}
                        >
                          + {m.name}{q ? ` ${q}` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Parsed quantity / unit — shopping only, where it adds value
                  (spec §quantity, §list-type-awareness). Clear labels, no × symbol. */}
              {list.type === 'shopping' && qtyInfo && (
                <div className="list-fade-in" role="group" aria-label={`Quantity ${qtyInfo.quantity}${qtyInfo.unit ? `, unit ${qtyInfo.unit}` : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Quantity</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{qtyInfo.quantity}</span>
                  {qtyInfo.unit && (
                    <>
                      <span style={{ color: 'var(--text-3)' }}>·</span>
                      <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Unit</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>{qtyInfo.unit}</span>
                    </>
                  )}
                </div>
              )}

              {/* Category chip — directly interactive (no separate Change button);
                  auto-suggested, always overridable (spec §category). */}
              {cats.length > 0 && currentCat && (
                <button
                  onClick={() => setPickerOpen(true)}
                  aria-haspopup="dialog"
                  aria-label={`Category: ${currentCat.name}. Tap to change.`}
                  className="list-fade-in"
                  style={{
                    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
                    height: 40, padding: '0 12px', borderRadius: 100, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, color: 'var(--text)', border: 'none',
                    background: `${currentCat.color}1f`,
                  }}
                >
                  {currentCat.emoji} {currentCat.name}
                  <ChevronDown size={15} style={{ opacity: 0.55, marginLeft: -1 }} />
                </button>
              )}
              {cats.length > 0 && !category && parsedInput.item && (
                <button onClick={() => setPickerOpen(true)}
                  aria-haspopup="dialog" aria-label="Choose a category"
                  style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, height: 40, padding: '0 14px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-3)', border: 'none' }}>
                  <Plus size={14} /> Category
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Merge confirm */}
      {showMerge && mergeTarget && pendingAdd && (
        <>
          <div className="sheet-overlay" />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>"{mergeTarget.title}" already exists</p>
              <p className="text-muted text-sm">
                Existing: <strong>{formatQuantity(mergeTarget.quantity) || '—'}</strong> · Adding: <strong>{formatQuantity(pendingAdd.qty)}</strong> → Combined: <strong>{formatQuantity(mergeQuantities(mergeTarget.quantity, pendingAdd.qty))}</strong>
              </p>
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={async () => { await store.addItem(list.id, pendingAdd.title, pendingAdd.qty, pendingAdd.category); setShowMerge(false); setMergeTarget(null); resetAdd(); flashAddedToast(formatItemLabel(pendingAdd.title, pendingAdd.qty)) }}>Add Separate</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMerge}>Merge Qty</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Category picker (add flow) */}
      <CategoryPickerSheet
        open={pickerOpen}
        categories={cats}
        selected={category}
        onSelect={id => { setCategory(id); setCatSticky(true) }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
