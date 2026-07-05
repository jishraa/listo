import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useListsStore } from '../../store/useListsStore'
import { detectCategoryIn, parseItemInput, GROCERY_VOCAB } from '../../lib/constants'
import { capitalize } from '../../lib/utils'
import CategoryPickerSheet from './CategoryPickerSheet'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

// The Add Item bottom sheet (extracted from ListDetail): smart quantity
// parsing, category auto-detect, GROCERY_VOCAB suggestions, frequent-item
// one-tap chips, the "✓ added" confirmation, and the duplicate-merge
// confirm. Rapid entry: adding clears the field and keeps the keyboard open.

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

  // Transient "✓ added" confirmation
  const [addedToast, setAddedToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flashAddedToast(title: string) {
    setAddedToast(title)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setAddedToast(null), 2200)
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

  const suggestions = useMemo(() => {
    const q = parsedInput.item.toLowerCase()
    if (q.length < 2) return []
    const pool = list.type === 'shopping' ? GROCERY_VOCAB : []
    return pool.filter(t => t.toLowerCase().startsWith(q) && t.toLowerCase() !== q).slice(0, 5)
  }, [parsedInput, list.type])

  // Frequent items from the user's own history across lists — shown as
  // one-tap add chips while the field is empty (recommended additions §2).
  const frequentItems = useMemo(() => {
    const counts = new Map<string, number>()
    Object.values(store.items).flat().forEach(i => {
      const k = i.title.trim().toLowerCase()
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    })
    const pendingHere = new Set(items.filter(i => !i.completed).map(i => i.title.toLowerCase()))
    return [...counts.entries()]
      .filter(([t, n]) => n >= 2 && !pendingHere.has(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => capitalize(t))
  }, [store.items, items])

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
    if (qty) {
      const existing = items.find(i => !i.completed && i.title.toLowerCase() === t.toLowerCase() && i.quantity)
      if (existing) {
        setPendingAdd({ title: t, qty, category: finalCat ?? null })
        setMergeTarget(existing); setShowMerge(true); return
      }
    }
    resetAdd(); setFlashing(true)
    await store.addItem(list.id, t, qty, finalCat ?? null)
    setFlashing(false)
    flashAddedToast(qty ? `${t} ${qty}` : t)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  async function handleMerge() {
    if (!mergeTarget || !pendingAdd) return
    const combined = mergeQuantities(mergeTarget.quantity, pendingAdd.qty)
    setShowMerge(false); setMergeTarget(null); resetAdd()
    await store.updateItem(list.id, mergeTarget.id, { title: mergeTarget.title, quantity: combined, category: mergeTarget.category })
    setPendingAdd(null)
  }

  async function addFrequent(title: string) {
    await store.addItem(list.id, title, '', detectCategoryIn(cats, title) ?? null)
    flashAddedToast(title)
    inputRef.current?.focus()
  }

  const currentCat = category ? catById.get(category) : null

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
                    placeholder={list.type === 'shopping' ? 'Add item… e.g. Milk ×2 or Rice 2kg' : 'Add an item…'}
                    maxLength={200}
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
                    style={{
                      flexShrink: 0, width: 48, height: 48, borderRadius: 10, border: 'none',
                      background: parsedInput.item ? 'var(--accent)' : 'var(--bg-input)',
                      color: parsedInput.item ? '#fff' : 'var(--text-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
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
                      <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                        style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* "✓ added" confirmation — directly below the input, close to the
                  action that triggered it; auto-hides after ~2s (spec §2.1) */}
              {addedToast && (
                <span className="list-fade-in" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                  padding: '4px 2px', color: 'var(--accent)', fontSize: 13, fontWeight: 600,
                }}>
                  <Check size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addedToast} added</span>
                </span>
              )}

              {/* Frequent items — one-tap add while the field is empty */}
              {!input && frequentItems.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                    Frequent
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {frequentItems.map(t => (
                      <button
                        key={t}
                        onClick={() => addFrequent(t)}
                        style={{
                          height: 34, padding: '0 13px', borderRadius: 17, cursor: 'pointer',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          fontSize: 13, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap',
                        }}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Parsed qty badge */}
              {parsedInput.qty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</span>
                  <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#04080f' }}>{parsedInput.qty}</span>
                </div>
              )}

              {/* Category — hidden until auto-detect picks one from the typed
                  item; Change opens the dedicated picker sheet */}
              {cats.length > 0 && currentCat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                    background: `${currentCat.color}1f`, color: 'var(--text)',
                  }}>{currentCat.emoji} {currentCat.name}</span>
                  <button onClick={() => setPickerOpen(true)}
                    style={{ padding: '6px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-2)', border: 'none' }}>
                    Change
                  </button>
                </div>
              )}
              {cats.length > 0 && !category && parsedInput.item && (
                <button onClick={() => setPickerOpen(true)}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-3)', border: 'none' }}>
                  ＋ Category
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
                Existing: <strong>{mergeTarget.quantity || '—'}</strong> · Adding: <strong>{pendingAdd.qty}</strong> → Combined: <strong>{mergeQuantities(mergeTarget.quantity, pendingAdd.qty)}</strong>
              </p>
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={async () => { await store.addItem(list.id, pendingAdd.title, pendingAdd.qty, pendingAdd.category); setShowMerge(false); setMergeTarget(null); resetAdd(); flashAddedToast(pendingAdd.title) }}>Add Separate</button>
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
