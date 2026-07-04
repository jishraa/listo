import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowUpDown, BarChart2, Check, Copy, FileText, LayoutTemplate, MoreVertical, Pencil, Plus, RefreshCw, Share2, Trash2, X } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import type { ListItem } from '../types'
import { detectCategoryIn, parseItemInput, GROCERY_VOCAB } from '../lib/constants'
import { useCategoriesStore } from '../store/useCategoriesStore'
import { exportListReport } from '../lib/report'
import { openYft } from '../lib/yft'
import { SwipeRow } from '../components/lists/SwipeRow'
import ShareListSheet from '../components/lists/ShareListSheet'
import CategoryPickerSheet from '../components/lists/CategoryPickerSheet'

type SortMode = 'date' | 'alpha' | 'category'

function formatCompletedAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `today at ${time}`
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return `yesterday at ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
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

function Overlay({ onClick }: { onClick?: () => void }) {
  return <div className="sheet-overlay" onClick={onClick} />
}

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = useListsStore()
  const { user } = useAuthStore()

  const list    = store.lists.find(l => l.id === id)
  const rawItems = list ? store.items[list.id] : undefined
  const items   = rawItems ?? []
  const members = list ? (store.members[list.id] ?? []) : []
  const isOwner = !!list && list.owner_id === user?.id

  // ── Add sheet state ─────────────────────────────────────────
  const [showAdd,         setShowAdd]         = useState(false)
  const [addInput,        setAddInput]        = useState('')
  const [addCategory,     setAddCategory]     = useState<string | null>(null)
  const [addCatSticky,    setAddCatSticky]    = useState(false)
  const [addFlashing,     setAddFlashing]     = useState(false)
  const [showMerge,       setShowMerge]       = useState(false)
  const [mergeTarget,     setMergeTarget]     = useState<ListItem | null>(null)
  const [pendingAdd,      setPendingAdd]      = useState<{ title: string; qty: string; category: string | null } | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Edit state ───────────────────────────────────────────────
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editTitle,    setEditTitle]    = useState('')
  const [editQty,      setEditQty]      = useState('')
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const [qtyEditId,    setQtyEditId]    = useState<string | null>(null)
  const [qtyDraft,     setQtyDraft]     = useState('')
  const editTitleRef = useRef<HTMLInputElement>(null)

  // ── UI state ────────────────────────────────────────────────
  const [menuOpen,         setMenuOpen]         = useState(false)
  const [sortMenuOpen,     setSortMenuOpen]     = useState(false)
  const [insightsOpen,     setInsightsOpen]     = useState(false)
  const [shareOpen,        setShareOpen]        = useState(false)
  const [renaming,         setRenaming]         = useState(false)
  const [renameValue,      setRenameValue]      = useState('')
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [showCompleted,    setShowCompleted]    = useState(false)
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
  // Which flow the category picker sheet is serving (add sheet vs row edit)
  const [catPickerFor,     setCatPickerFor]     = useState<'add' | 'edit' | null>(null)
  const [dupeReviewOpen,   setDupeReviewOpen]   = useState(false)
  const [undoItem,         setUndoItem]         = useState<ListItem | null>(null)
  const [unchecking,       setUnchecking]       = useState(false)
  const [completionTime,   setCompletionTime]   = useState<string | null>(() =>
    id ? localStorage.getItem(`listo-completed-${id}`) : null
  )
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (!id) return 'date'
    const s = localStorage.getItem(`listo-sort-${id}`)
    return (s === 'alpha' || s === 'category') ? s : 'date'
  })
  // Transient "✓ added" confirmation in the add sheet
  const [addedToast, setAddedToast] = useState<string | null>(null)
  const addedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashAddedToast(title: string) {
    setAddedToast(title)
    if (addedToastTimer.current) clearTimeout(addedToastTimer.current)
    addedToastTimer.current = setTimeout(() => setAddedToast(null), 2200)
  }
  useEffect(() => () => { if (addedToastTimer.current) clearTimeout(addedToastTimer.current) }, [])

  useEffect(() => {
    if (!id) return
    store.loadItems(id)
    store.loadMembers(id)
    const unsub = store.subscribeToList(id)
    return unsub
  }, [id])

  useEffect(() => { if (id) localStorage.setItem(`listo-sort-${id}`, sortMode) }, [id, sortMode])

  const isAllComplete = items.length > 0 && items.every(i => i.completed)
  useEffect(() => {
    if (!id) return
    if (isAllComplete) {
      if (!completionTime) {
        const t = new Date().toISOString()
        setCompletionTime(t)
        localStorage.setItem(`listo-completed-${id}`, t)
      }
    } else if (completionTime) {
      setCompletionTime(null)
      localStorage.removeItem(`listo-completed-${id}`)
    }
  }, [id, isAllComplete])

  // Auto-collapse the completed section once shopping is nearly done, so
  // focus stays on the few remaining items (spec §2). Only fires on the
  // transition into that state — the user can still expand manually after.
  const doneNow = items.filter(i => i.completed).length
  const nearlyDone = items.length > 3 && (doneNow / items.length >= 0.8 || (items.length - doneNow) <= 2)
  const wasNearlyDone = useRef(false)
  useEffect(() => {
    if (nearlyDone && !wasNearlyDone.current) setShowCompleted(false)
    wasNearlyDone.current = nearlyDone
  }, [nearlyDone])

  const allCategories = useCategoriesStore(s2 => s2.categories)
  const cats = list ? allCategories[list.type] : []

  // Auto-detect category
  useEffect(() => {
    if (!list || addCatSticky) return
    const { item } = parseItemInput(addInput)
    if (!item) { setAddCategory(null); return }
    const t = setTimeout(() => {
      const detected = detectCategoryIn(allCategories[list.type], item)
      if (detected) setAddCategory(detected)
    }, 250)
    return () => clearTimeout(t)
  }, [addInput, list, addCatSticky, allCategories])

  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])

  const usedCatIds = useMemo(() => {
    const s = new Set<string>()
    items.forEach(i => { if (i.category) s.add(i.category) })
    return s
  }, [items])

  // Duplicate detection
  const dupeGroups = useMemo(() => {
    const groups = new Map<string, ListItem[]>()
    items.forEach(i => {
      const key = i.title.trim().toLowerCase()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(i)
    })
    const result = new Map<string, ListItem[]>()
    groups.forEach((g, k) => { if (g.length > 1) result.set(k, g) })
    return result
  }, [items])
  const dupeIds = useMemo(() => {
    const s = new Set<string>(); dupeGroups.forEach(g => g.forEach(i => s.add(i.id))); return s
  }, [dupeGroups])
  const uncategorizedPending = useMemo(
    () => items.filter(i => !i.completed && !i.category), [items]
  )

  // Suggestions
  const parsedInput = useMemo(() => parseItemInput(addInput), [addInput])
  const suggestions = useMemo(() => {
    if (!list) return []
    const q = parsedInput.item.toLowerCase()
    if (q.length < 2) return []
    const pool = list.type === 'shopping' ? GROCERY_VOCAB : []
    return pool.filter(t => t.toLowerCase().startsWith(q) && t.toLowerCase() !== q).slice(0, 5)
  }, [parsedInput, list])

  // Sorted + filtered items
  const visible = filterCategories.size === 0 ? items : items.filter(i => i.category && filterCategories.has(i.category))
  const sorted = useMemo(() => {
    if (sortMode === 'alpha') return [...visible].sort((a, b) => a.title.localeCompare(b.title))
    if (sortMode === 'category') return [...visible].sort((a, b) => (a.category ?? 'zzz').localeCompare(b.category ?? 'zzz'))
    return [...visible].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [visible, sortMode])

  const pending   = sorted.filter(i => !i.completed)
  const completed = sorted.filter(i => i.completed)
  const doneCount = items.filter(i => i.completed).length
  const itemsLeft = items.length - doneCount
  const pct = items.length > 0 ? (doneCount / items.length) * 100 : 0
  // Only the final pending item gets special treatment (spec §1)
  const lastItemLeft = itemsLeft === 1 && items.length > 1
  // Contextual progress copy (spec §6)
  const progressMsg =
    pct >= 100 ? (list?.type === 'shopping' ? 'Shopping complete 🎉' : 'All done 🎉')
    : lastItemLeft ? 'Only one item left 🎉'
    : pct >= 75 ? 'Almost done'
    : pct >= 50 ? 'Halfway there'
    : pct > 0   ? 'Good start!'
    : "Let's get started"

  // ── Handlers ────────────────────────────────────────────────
  function startEdit(item: ListItem) {
    setEditingId(item.id); setEditTitle(item.title)
    setEditQty(item.quantity ?? ''); setEditCategory(item.category)
    setTimeout(() => editTitleRef.current?.focus(), 60)
  }
  function cancelEdit() { setEditingId(null); setEditTitle(''); setEditQty(''); setEditCategory(null) }

  async function commitEdit(item: ListItem) {
    const t = editTitle.trim()
    if (!t) { cancelEdit(); return }
    if (t === item.title && (editQty.trim() || null) === item.quantity && editCategory === item.category) { cancelEdit(); return }
    await store.updateItem(list!.id, item.id, { title: t, quantity: editQty.trim() || null, category: editCategory })
    cancelEdit()
  }

  const handleDelete = useCallback((item: ListItem) => {
    if (!list) return
    store.deleteItem(list.id, item.id)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoItem(item)
    undoTimer.current = setTimeout(() => setUndoItem(null), 3500)
  }, [list])

  async function handleUndo(item: ListItem) {
    if (!list) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoItem(null)
    await store.addItem(list.id, item.title, item.quantity ?? '', item.category)
  }

  function resetAdd() {
    setAddInput(''); setAddCategory(null); setAddCatSticky(false)
    setShowMerge(false); setMergeTarget(null); setPendingAdd(null)
  }

  async function handleSheetAdd() {
    const { item: t, qty } = parseItemInput(addInput)
    if (!t || !list) return
    const finalCat = addCatSticky ? addCategory : (addCategory ?? detectCategoryIn(cats, t))
    if (qty) {
      const existing = items.find(i => !i.completed && i.title.toLowerCase() === t.toLowerCase() && i.quantity)
      if (existing) {
        setPendingAdd({ title: t, qty, category: finalCat ?? null })
        setMergeTarget(existing); setShowMerge(true); return
      }
    }
    resetAdd(); setAddFlashing(true)
    await store.addItem(list.id, t, qty, finalCat ?? null)
    setAddFlashing(false)
    flashAddedToast(t)
    setTimeout(() => addInputRef.current?.focus(), 60)
  }

  async function handleMerge() {
    if (!mergeTarget || !pendingAdd || !list) return
    const combined = mergeQuantities(mergeTarget.quantity, pendingAdd.qty)
    setShowMerge(false); setMergeTarget(null); resetAdd()
    await store.updateItem(list.id, mergeTarget.id, { title: mergeTarget.title, quantity: combined, category: mergeTarget.category })
    setPendingAdd(null)
  }

  if (!list) return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronLeft size={20} /></button>
        <span className="header-title">Loading…</span>
      </div>
    </div>
  )

  // ── Render item row ─────────────────────────────────────────
  const renderItem = (item: ListItem) => {
    const isEditing = editingId === item.id
    const cat = item.category ? catById.get(item.category) : null
    // The single remaining pending item gets a subtle highlight (spec §1)
    const isFinalItem = lastItemLeft && !item.completed

    if (isEditing) return (
      <div key={item.id} style={{
        padding: '12px 16px', background: 'var(--bg-input)',
        borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div className="flex gap-2">
          <input
            ref={editTitleRef}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') cancelEdit() }}
            maxLength={200}
            style={{
              flex: 1, height: 40, borderRadius: 8, padding: '0 12px',
              background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
              color: 'var(--text)', fontSize: 15, outline: 'none',
            }}
          />
          {list.type === 'shopping' && (
            <input
              value={editQty}
              onChange={e => setEditQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') cancelEdit() }}
              placeholder="Qty"
              maxLength={20}
              style={{
                width: 56, height: 40, borderRadius: 8, padding: '0 8px',
                background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
                color: 'var(--text)', fontSize: 15, outline: 'none', textAlign: 'center',
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between">
          {cats.length > 0 ? (
            <button
              onClick={() => setCatPickerFor('edit')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: editCategory && catById.get(editCategory) ? `${catById.get(editCategory)!.color}1f` : 'var(--bg-input)',
                color: editCategory ? 'var(--text)' : 'var(--text-3)',
                border: 'none',
              }}>
              {editCategory && catById.get(editCategory)
                ? <>{catById.get(editCategory)!.emoji} {catById.get(editCategory)!.name}</>
                : '＋ Category'}
            </button>
          ) : <div />}
          <div className="flex gap-2" style={{ marginLeft: 8, flexShrink: 0 }}>
            <button onClick={() => commitEdit(item)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              <Check size={14} strokeWidth={2.5} />
            </button>
            <button onClick={cancelEdit}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <SwipeRow key={item.id} onDelete={() => handleDelete(item)}>
        {isFinalItem && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px 0',
            background: 'var(--accent-dim)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            🛒 Last item
          </div>
        )}
        <div className="flex items-center gap-3" style={{ padding: '12px 14px', background: isFinalItem ? 'var(--accent-dim)' : 'var(--bg-card)' }}>
          {/* Checkbox — 44px touch target around the 22px control (spec §17) */}
          <button
            onClick={() => store.toggleItem(list.id, item)}
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
            style={{
              flexShrink: 0, width: 40, height: 40, margin: -9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              border: `2px solid ${item.completed ? 'var(--accent)' : 'var(--border-2)'}`,
              background: item.completed ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 180ms ease',
            }}>
              {item.completed && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
            </span>
          </button>

          {/* Title area — tap to edit. 17px/600 title, one 13px metadata line (spec §5/§13) */}
          <div
            onClick={() => { if (!item.completed) { cancelEdit(); startEdit(item) } }}
            style={{ flex: 1, minWidth: 0, cursor: item.completed ? 'default' : 'pointer' }}
          >
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 17, fontWeight: 600,
                color: item.completed ? 'var(--text-3)' : 'var(--text)',
                textDecoration: item.completed ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 200ms ease',
              }}>{item.title}</span>
              {dupeIds.has(item.id) && !isEditing && (
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 600,
                  color: '#d97706', background: 'rgba(217,119,6,0.12)',
                  borderRadius: 99, padding: '2px 6px',
                }}>Dup</span>
              )}
            </div>
            {(cat || item.added_by_name || item.completed_by_name) && (
              <div className="flex items-center" style={{ gap: 6, marginTop: 3 }}>
                {/* Category as a compact neutral chip (spec §5) */}
                {cat && (
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600, lineHeight: 1,
                    padding: '3px 7px', borderRadius: 6,
                    background: item.completed ? 'var(--bg-input)' : `${cat.color}1f`,
                    color: item.completed ? 'var(--text-3)' : 'var(--text-2)',
                  }}>{cat.name}</span>
                )}
                {(() => {
                  const who = item.completed
                    ? (item.completed_by_name ? `✓ ${item.completed_by_name}` : null)
                    : (members.length > 1 && item.added_by_name ? `by ${item.added_by_name}` : null)
                  return who ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
                  ) : null
                })()}
              </div>
            )}
          </div>

          {/* Qty chip (shopping only) */}
          {list.type === 'shopping' && !item.completed && (
            qtyEditId === item.id ? (
              <input
                autoFocus
                value={qtyDraft}
                onChange={e => setQtyDraft(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    if (e.key === 'Enter') await store.updateItem(list.id, item.id, { title: item.title, quantity: qtyDraft.trim() || null, category: item.category })
                    setQtyEditId(null)
                  }
                }}
                onBlur={async () => {
                  await store.updateItem(list.id, item.id, { title: item.title, quantity: qtyDraft.trim() || null, category: item.category })
                  setQtyEditId(null)
                }}
                placeholder="Qty"
                maxLength={20}
                style={{
                  flexShrink: 0, width: 58, height: 28, borderRadius: 99, padding: '0 8px',
                  textAlign: 'center', background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
                  color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none',
                }}
              />
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setQtyDraft(item.quantity ?? ''); setQtyEditId(item.id) }}
                style={{
                  flexShrink: 0, padding: '3px 9px', borderRadius: 99,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  color: item.quantity ? 'var(--text-2)' : 'var(--text-3)',
                }}
              >{item.quantity || '—'}</button>
            )
          )}
          {list.type === 'shopping' && item.completed && item.quantity && (
            <span style={{
              flexShrink: 0, padding: '3px 9px', borderRadius: 99,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, color: 'var(--text-3)', opacity: 0.6,
            }}>{item.quantity}</span>
          )}
        </div>
      </SwipeRow>
    )
  }

  // ── Sheet styles ────────────────────────────────────────────
  const sectionLabel: CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    color: 'var(--text-3)', textTransform: 'uppercase',
  }

  // ── Insights precomputed vars ────────────────────────────────
  const insTotal = items.length
  const insDone = items.filter(i => i.completed).length
  const insPctDone = insTotal > 0 ? Math.round((insDone / insTotal) * 100) : 0
  const insCatStats = cats.map(c => {
    const catItems = items.filter(i => i.category === c.id)
    const catDone = catItems.filter(i => i.completed).length
    return { ...c, total: catItems.length, done: catDone }
  }).filter(c => c.total > 0)
  const insUncategorised = items.filter(i => !i.category)
  const insUncatDone = insUncategorised.filter(i => i.completed).length
  const insMemberAdded: Record<string, number> = {}
  const insMemberCompleted: Record<string, number> = {}
  items.forEach(i => {
    if (i.added_by_name)     insMemberAdded[i.added_by_name]     = (insMemberAdded[i.added_by_name] || 0) + 1
    if (i.completed_by_name) insMemberCompleted[i.completed_by_name] = (insMemberCompleted[i.completed_by_name] || 0) + 1
  })
  const insTopAdder    = Object.entries(insMemberAdded).sort((a, b) => b[1] - a[1])[0]
  const insTopCompleter = Object.entries(insMemberCompleted).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronLeft size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {list.emoji} {list.name}
          </p>
          {/* Shared lists keep the live done-count in the header so members
              see collective progress at a glance (personal lists stay compact) */}
          {members.length > 1 && items.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>
              {isAllComplete ? 'All done' : `${itemsLeft} ${itemsLeft === 1 ? 'item' : 'items'} left`}
            </p>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)}><MoreVertical size={20} /></button>
      </div>

      <div className="page">
        {/* Member avatars */}
        {members.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px 0' }}>
            {members.slice(0, 5).map((m, i) => (
              <div key={m.id} style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: `hsl(${(m.display_name.charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                border: '2px solid var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 5 - i,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{m.display_name[0]?.toUpperCase()}</span>
              </div>
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {members.map(m => m.user_id === user?.id ? 'You' : m.display_name).join(', ')}
            </span>
          </div>
        )}

        {/* Compact contextual progress (spec §1–2): one line + 4px bar,
            bar hidden until something is completed */}
        {items.length > 0 && (
          <div style={{ padding: '10px 16px 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: doneCount > 0 ? 6 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isAllComplete ? 'var(--accent)' : 'var(--text-2)' }}>
                {progressMsg}
              </span>
              {!isAllComplete && (
                <span style={{ fontSize: 13, fontWeight: 500, color: doneCount > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                  {itemsLeft} {itemsLeft === 1 ? 'item' : 'items'} left{doneCount > 0 ? ` • ${Math.round(pct)}%` : ''}
                </span>
              )}
            </div>
            {doneCount > 0 && (
              <div className="progress-bar" style={{ height: 4 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)', transition: 'width 250ms var(--ease)' }} />
              </div>
            )}
          </div>
        )}

        {/* Category filter strip */}
        {list.type === 'shopping' && usedCatIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
            {/* Lightweight pills (spec §3/§9): filled green when active,
                neutral background otherwise — no outlines, no glow */}
            <button onClick={() => setFilterCategories(new Set())} style={{
              flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 99, cursor: 'pointer',
              background: filterCategories.size === 0 ? 'var(--accent)' : 'var(--bg-input)',
              color: filterCategories.size === 0 ? '#030a14' : 'var(--text-2)',
              border: 'none',
              fontSize: 13, fontWeight: filterCategories.size === 0 ? 700 : 500,
              transition: 'background 150ms ease, color 150ms ease',
            }}>All</button>
            {cats.filter(c => usedCatIds.has(c.id)).map(c => {
              const active = filterCategories.has(c.id)
              return (
                <button key={c.id} onClick={() => setFilterCategories(prev => {
                  const next = new Set(prev); active ? next.delete(c.id) : next.add(c.id); return next
                })} style={{
                  flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 99, cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'var(--bg-input)',
                  color: active ? '#030a14' : 'var(--text-2)',
                  border: 'none',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  transition: 'background 150ms ease, color 150ms ease',
                }}>{c.name}</button>
              )
            })}
          </div>
        )}

        {/* Smart banner (spec §4/§16) — one at a time, only when actionable */}
        {dupeGroups.size > 0 ? (
          <div style={{ padding: '0 16px 8px' }}>
            <button
              onClick={() => setDupeReviewOpen(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderRadius: 10, background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.28)',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#d97706' }}>
                ⚠ {dupeGroups.size} duplicate {dupeGroups.size === 1 ? 'item' : 'items'} found
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706', flexShrink: 0 }}>Review →</span>
            </button>
          </div>
        ) : uncategorizedPending.length > 0 && list.type === 'shopping' ? (
          <div style={{ padding: '0 16px 8px' }}>
            <button
              onClick={() => { cancelEdit(); startEdit(uncategorizedPending[0]) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                ⚠ {uncategorizedPending.length} uncategorized {uncategorizedPending.length === 1 ? 'item' : 'items'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>Categorize →</span>
            </button>
          </div>
        ) : null}

        {/* Error banner */}
        {store.lastError && (
          <div className="error-msg" style={{ margin: '0 16px 8px' }}>
            {store.lastError}
            <button onClick={store.clearError} style={{ float: 'right', fontWeight: 700, background: 'none', color: '#dc2626', fontSize: 16 }}>✕</button>
          </div>
        )}

        <div
          key={`${sortMode}-${[...filterCategories].sort().join(',')}`}
          className="list-fade-in"
          style={{ padding: '0 16px 140px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {/* Loading skeleton */}
          {rawItems === undefined ? (
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[72, 56, 88, 64].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="skeleton" style={{ width: `${w}%`, height: 14 }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36 }}>{list.emoji}</div>
              <p style={{ fontWeight: 600, fontSize: 15 }}>Ready to start?</p>
              <p className="text-muted text-sm">
                {list.type === 'shopping' ? 'Add your first grocery item.' : list.type === 'tasks' ? 'Add your first task.' : 'Add your first item.'}
              </p>
            </div>
          ) : (
            <>
              {/* Celebration card */}
              {isAllComplete && (
                <div style={{
                  borderRadius: 14, padding: '18px 16px',
                  background: 'linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0.06) 100%)',
                  border: '1px solid rgba(22,163,74,0.3)',
                }}>
                  <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
                    {list.type === 'shopping' ? 'Shopping complete! 🎉' : 'All done! 🎉'}
                  </p>
                  {completionTime && <p className="text-sm text-muted" style={{ margin: '0 0 14px' }}>Completed {formatCompletedAt(completionTime)}</p>}
                  {/* Primary next step (spec §9): review what you bought */}
                  <button onClick={() => setInsightsOpen(true)} className="btn btn-primary btn-full" style={{ marginBottom: 8 }}>
                    <BarChart2 size={15} /> View Insights
                  </button>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <button onClick={() => { setShowAdd(true); setTimeout(() => addInputRef.current?.focus(), 80) }}
                      className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}><Plus size={14} /> Add more</button>
                    <button disabled={unchecking} onClick={async () => { setUnchecking(true); await store.uncheckAll(list.id); setUnchecking(false) }}
                      className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
                      <RefreshCw size={13} style={unchecking ? { animation: 'spin 1s linear infinite' } : {}} /> Reset
                    </button>
                    {isOwner && <button onClick={() => setShareOpen(true)} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
                      <Share2 size={13} /> Share
                    </button>}
                  </div>
                  {/* Companion nudge — shopping done → record the expense in YFT */}
                  {list.type === 'shopping' && (
                    <button
                      onClick={() => openYft('/tracker/monthly')}
                      style={{
                        width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                      }}>
                      <img src="/yft.png" alt="YFT" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>
                        Record today's shopping expense?
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                        Track in YFT →
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <div className="flex items-center justify-between" style={{ margin: '4px 2px 0' }}>
                    <span style={sectionLabel}>Pending ({pending.length})</span>
                  </div>
                  <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {pending.map((item, idx) => (
                      <div key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                        {renderItem(item)}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Completed */}
              {completed.length > 0 && (
                <>
                  <div className="flex items-center justify-between" style={{ margin: '4px 2px 0' }}>
                    <span style={sectionLabel}>Completed ({completed.length})</span>
                    <button onClick={() => setShowCompleted(v => !v)}
                      style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer', padding: '8px 4px', margin: '-8px -4px' }}>
                      {showCompleted ? 'Hide ▲' : 'Show ▼'}
                    </button>
                  </div>
                  {showCompleted && (
                    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6 }}>
                      {completed.map((item, idx) => (
                        <div key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                          {renderItem(item)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB — morphs away while the add sheet is open (spec §7) */}
      <button
        className="fab"
        aria-label="Add item"
        onClick={() => { setShowAdd(true); setTimeout(() => addInputRef.current?.focus(), 80) }}
        style={{
          transform: showAdd ? 'scale(0.5)' : 'none',
          opacity: showAdd ? 0 : 1,
          pointerEvents: showAdd ? 'none' : 'auto',
          transition: 'transform 220ms var(--ease), opacity 220ms var(--ease)',
        }}
      >
        <Plus size={24} />
      </button>

      {/* ── Add Item Sheet ── */}
      {showAdd && (
        <>
          <Overlay onClick={() => { resetAdd(); setShowAdd(false) }} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Add Item</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>to {list.name}</p>
                </div>
                {/* "✓ added" confirmation — auto-hides after ~2s */}
                {addedToast && (
                  <span className="list-fade-in" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    padding: '5px 12px', borderRadius: 99, maxWidth: '55%',
                    background: 'var(--accent-dim)', color: 'var(--accent)',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    <Check size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addedToast} added</span>
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <div className="flex gap-2">
                  <input
                    ref={addInputRef}
                    value={addInput}
                    onChange={e => setAddInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSheetAdd()}
                    placeholder={list.type === 'shopping' ? 'Item name or "Milk x2"' : 'Add an item…'}
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
                    onClick={handleSheetAdd}
                    disabled={!parsedInput.item || addFlashing}
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
                      <button key={s} onClick={() => { setAddInput(s); addInputRef.current?.focus() }}
                        style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Parsed qty badge */}
              {parsedInput.qty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</span>
                  <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#04080f' }}>{parsedInput.qty}</span>
                </div>
              )}

              {/* Category — hidden until auto-detect picks one from the typed
                  item; Change opens the dedicated picker sheet */}
              {cats.length > 0 && addCategory && (() => {
                const c = catById.get(addCategory)
                if (!c) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                      background: `${c.color}1f`, color: 'var(--text)',
                    }}>{c.emoji} {c.name}</span>
                    <button onClick={() => setCatPickerFor('add')}
                      style={{ padding: '6px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-2)', border: 'none' }}>
                      Change
                    </button>
                  </div>
                )
              })()}
              {cats.length > 0 && !addCategory && parsedInput.item && (
                <button onClick={() => setCatPickerFor('add')}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-3)', border: 'none' }}>
                  ＋ Category
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Merge confirm ── */}
      {showMerge && mergeTarget && pendingAdd && (
        <>
          <Overlay />
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

      {/* ── Menu ── */}
      {menuOpen && (
        <>
          <Overlay onClick={() => setMenuOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '8px 0 8px' }}>
              {[
                { icon: <ArrowUpDown size={16} />, label: 'Sort', hint: sortMode === 'alpha' ? 'A → Z' : sortMode === 'category' ? 'Category' : 'Date added', action: () => { setMenuOpen(false); setSortMenuOpen(true) } },
                { icon: <BarChart2 size={16} />, label: 'Insights', hint: '', action: () => { setMenuOpen(false); setInsightsOpen(true) } },
                { icon: <FileText size={16} />, label: 'Export Report', hint: 'PDF', action: async () => { setMenuOpen(false); await exportListReport(list, items, members) }, disabled: items.length === 0 },
                { icon: <Pencil size={16} />, label: 'Rename', hint: '', action: () => { setRenameValue(list.name); setMenuOpen(false); setRenaming(true); setTimeout(() => renameRef.current?.focus(), 80) } },
                isOwner ? { icon: <Copy size={16} />, label: 'Duplicate', hint: '', action: async () => { setMenuOpen(false); await store.duplicateList(list.id) } } : null,
                isOwner ? { icon: <LayoutTemplate size={16} />, label: 'Save as Template', hint: '', action: async () => { setMenuOpen(false); await store.saveAsTemplate(list.id) } } : null,
                isOwner ? { icon: <Share2 size={16} />, label: 'Share', hint: '', action: () => { setMenuOpen(false); setShareOpen(true) } } : null,
                { icon: <Check size={16} />, label: `Clear Completed${completed.length > 0 ? ` (${completed.length})` : ''}`, hint: '', action: async () => { setMenuOpen(false); setUnchecking(true); await store.uncheckAll(list.id); setUnchecking(false) }, disabled: completed.length === 0 },
                isOwner ? { icon: <Trash2 size={16} color="#ef4444" />, label: 'Delete List', hint: '', action: () => { setMenuOpen(false); setConfirmDelete(true) }, danger: true } : null,
              ].filter(Boolean).map((item, i) => {
                const it = item as { icon: ReactNode; label: string; hint: string; action: () => void; disabled?: boolean; danger?: boolean }
                return (
                  <button key={i} onClick={it.action} disabled={it.disabled}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 20px', background: 'none', border: 'none',
                      cursor: it.disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                      opacity: it.disabled ? 0.4 : 1,
                    }}>
                    <span style={{ color: it.danger ? '#ef4444' : 'var(--text-2)' }}>{it.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: it.danger ? '#ef4444' : 'var(--text)', flex: 1 }}>{it.label}</span>
                    {it.hint && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{it.hint}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Sort sheet ── */}
      {sortMenuOpen && (
        <>
          <Overlay onClick={() => setSortMenuOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', margin: '10px 20px 6px' }}>Sort by</p>
            {([
              { key: 'date', label: 'Date added', hint: 'Newest first' },
              { key: 'alpha', label: 'Alphabetical', hint: 'A → Z' },
              { key: 'category', label: 'Category', hint: 'Grouped' },
            ] as { key: SortMode; label: string; hint: string }[]).map(opt => {
              const active = sortMode === opt.key
              return (
                <button key={opt.key} onClick={() => { setSortMode(opt.key); setSortMenuOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text)', flex: 1 }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{opt.hint}</span>
                  {active && <Check size={16} strokeWidth={2.5} color="var(--accent)" />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Rename sheet ── */}
      {renaming && (
        <>
          <Overlay onClick={() => setRenaming(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Rename list</p>
              <input
                ref={renameRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') { const n = renameValue.trim(); if (n && n !== list.name) await store.renameList(list.id, n); setRenaming(false) }
                  if (e.key === 'Escape') setRenaming(false)
                }}
                maxLength={100}
                style={{ width: '100%', height: 48, borderRadius: 10, padding: '0 14px', background: 'var(--bg-input)', border: '1.5px solid var(--accent)', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRenaming(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, opacity: !renameValue.trim() || renameValue.trim() === list.name ? 0.4 : 1 }}
                  disabled={!renameValue.trim() || renameValue.trim() === list.name}
                  onClick={async () => { const n = renameValue.trim(); if (n && n !== list.name) await store.renameList(list.id, n); setRenaming(false) }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <>
          <Overlay onClick={() => setConfirmDelete(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Delete this list?</p>
              <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>
                "<strong>{list.name}</strong>" and all its items will be removed for everyone with access. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1 }}
                  onClick={async () => { setConfirmDelete(false); await store.deleteList(list.id); navigate('/') }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Insights (full screen) ── */}
      {insightsOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--bg)', display: 'flex', flexDirection: 'column',
          animation: 'slide-up 0.3s var(--ease)',
        }}>
          {/* Nav */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          }}>
            <button onClick={() => setInsightsOpen(false)}
              style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Insights · {list.emoji} {list.name}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Total', value: insTotal, color: 'var(--text)' },
                  { label: 'Done',  value: insDone,  color: '#16a34a' },
                  { label: 'Left',  value: insTotal - insDone, color: insTotal - insDone > 0 ? '#d97706' : 'var(--text-3)' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'var(--bg-input)', borderRadius: 12,
                    padding: '12px 10px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Overall progress */}
              {insTotal > 0 && (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Progress</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: insPctDone === 100 ? '#16a34a' : 'var(--accent)' }}>{insPctDone}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${insPctDone}%`, background: insPctDone === 100 ? '#16a34a' : 'var(--accent)', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {(insCatStats.length > 0 || insUncategorised.length > 0) && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>By Category</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insCatStats.map(c => {
                      const p = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
                      return (
                        <div key={c.id}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                            <div className="flex items-center gap-2">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.done}/{c.total} · {p}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, width: `${p}%`, background: c.color, opacity: 0.85, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                    {insUncategorised.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Uncategorised</span>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{insUncatDone}/{insUncategorised.length} · {insUncategorised.length > 0 ? Math.round((insUncatDone / insUncategorised.length) * 100) : 0}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${insUncategorised.length > 0 ? Math.round((insUncatDone / insUncategorised.length) * 100) : 0}%`, background: 'var(--text-3)', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Member activity */}
              {(insTopAdder || insTopCompleter) && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Member Activity</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {insTopAdder && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${(insTopAdder[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{insTopAdder[0][0]?.toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insTopAdder[0]}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Added {insTopAdder[1]} item{insTopAdder[1] !== 1 ? 's' : ''}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>Top Adder</span>
                      </div>
                    )}
                    {insTopCompleter && insTopCompleter[0] !== insTopAdder?.[0] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${(insTopCompleter[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{insTopCompleter[0][0]?.toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insTopCompleter[0]}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Checked off {insTopCompleter[1]} item{insTopCompleter[1] !== 1 ? 's' : ''}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Top Completer</span>
                      </div>
                    )}
                    {insTopCompleter && insTopCompleter[0] === insTopAdder?.[0] && (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '4px 0' }}>
                        {insTopAdder[0]} is leading on both adding and completing! 🏆
                      </div>
                    )}
                  </div>
                </div>
              )}

              {insTotal === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, padding: '16px 0' }}>Add some items to see insights.</p>
              )}

              {/* Companion card (YFT integration spec §1/§5) — shopping only */}
              {list.type === 'shopping' && (
                <button
                  onClick={() => openYft('/tracker/monthly')}
                  className="card card-press"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <img src="/yft.png" alt="YFT" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Track Grocery Spending</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      Shopping organized — track what you spend each month.
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Open in YFT →</span>
                </button>
              )}
            </div>
          </div>
      )}

      {/* ── Share sheet ── */}
      {shareOpen && (
        <ShareListSheet list={list} members={members} onClose={() => setShareOpen(false)} />
      )}

      {/* ── Category picker ── */}
      <CategoryPickerSheet
        open={catPickerFor !== null}
        categories={cats}
        selected={catPickerFor === 'edit' ? editCategory : addCategory}
        onSelect={id => {
          if (catPickerFor === 'edit') setEditCategory(id)
          else { setAddCategory(id); setAddCatSticky(true) }
        }}
        onClose={() => setCatPickerFor(null)}
      />

      {/* ── Duplicate review (spec §4) ── */}
      {dupeReviewOpen && (
        <>
          <Overlay onClick={() => setDupeReviewOpen(false)} />
          <div className="sheet" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ padding: '10px 20px 24px' }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Review duplicates</p>
              <p className="text-sm text-muted" style={{ margin: '0 0 16px' }}>
                Keep one of each and remove the extras.
              </p>
              {dupeGroups.size === 0 ? (
                <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
                  No duplicates left 🎉
                </p>
              ) : [...dupeGroups.entries()].map(([key, group]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    {group[0].title} · {group.length}
                  </p>
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {group.map((it, i) => (
                      <div key={it.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                        background: 'var(--bg-card)', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text)' }}>
                          {it.title}{it.quantity ? ` · ${it.quantity}` : ''}
                          {it.completed && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>✓</span>}
                        </span>
                        {i === 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Keep</span>
                        ) : (
                          <button
                            onClick={() => store.deleteItem(list.id, it.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-full" onClick={() => setDupeReviewOpen(false)} style={{ marginTop: 4 }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Undo delete toast ── */}
      {undoItem && (
        <div style={{
          position: 'fixed', bottom: 84, left: 16, right: 16, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: '13px 16px',
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ flex: 1, fontSize: 14, color: 'var(--text)', margin: 0 }}>
            "<span style={{ fontWeight: 600 }}>{undoItem.title}</span>" deleted
          </p>
          <button onClick={() => handleUndo(undoItem)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
