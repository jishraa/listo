import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpDown, BarChart2, Check, Copy, MoreVertical, Pencil, Plus, RefreshCw, Share2, Trash2, X } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import type { ListItem } from '../types'
import { LIST_CATEGORIES, detectCategory, parseItemInput, GROCERY_VOCAB } from '../lib/constants'
import { SwipeRow } from '../components/lists/SwipeRow'

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
  const [showCategories,   setShowCategories]   = useState(false)
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
  const [undoItem,         setUndoItem]         = useState<ListItem | null>(null)
  const [copied,           setCopied]           = useState(false)
  const [unchecking,       setUnchecking]       = useState(false)
  const [completionTime,   setCompletionTime]   = useState<string | null>(() =>
    id ? localStorage.getItem(`listo-completed-${id}`) : null
  )
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (!id) return 'date'
    const s = localStorage.getItem(`listo-sort-${id}`)
    return (s === 'alpha' || s === 'category') ? s : 'date'
  })
  const renameRef = useRef<HTMLInputElement>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => { if (isAllComplete) setShowCompleted(false) }, [isAllComplete])

  // Auto-detect category
  useEffect(() => {
    if (!list || addCatSticky) return
    const { item } = parseItemInput(addInput)
    if (!item) { setAddCategory(null); return }
    const t = setTimeout(() => {
      const detected = detectCategory(item, list.type)
      if (detected) setAddCategory(detected)
    }, 250)
    return () => clearTimeout(t)
  }, [addInput, list, addCatSticky])

  const cats = list ? LIST_CATEGORIES[list.type] : []
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
  const pct = items.length > 0 ? (items.filter(i => i.completed).length / items.length) * 100 : 0

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
    const finalCat = addCatSticky ? addCategory : (addCategory ?? detectCategory(t, list.type))
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
    setTimeout(() => addInputRef.current?.focus(), 60)
  }

  async function handleMerge() {
    if (!mergeTarget || !pendingAdd || !list) return
    const combined = mergeQuantities(mergeTarget.quantity, pendingAdd.qty)
    setShowMerge(false); setMergeTarget(null); resetAdd()
    await store.updateItem(list.id, mergeTarget.id, { title: mergeTarget.title, quantity: combined, category: mergeTarget.category })
    setPendingAdd(null)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${list!.invite_code}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!list) return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <span className="header-title">Loading…</span>
      </div>
    </div>
  )

  // ── Render item row ─────────────────────────────────────────
  const renderItem = (item: ListItem) => {
    const isEditing = editingId === item.id
    const cat = item.category ? catById.get(item.category) : null

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
              background: 'rgba(0,212,255,0.06)', border: '1.5px solid var(--accent)',
              boxShadow: '0 0 0 3px rgba(0,212,255,0.12)',
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
          {list.type === 'shopping' && cats.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {cats.map(c => (
                <button key={c.id} onClick={() => setEditCategory(editCategory === c.id ? null : c.id)}
                  style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: editCategory === c.id ? c.color : 'var(--bg-input)',
                    color: editCategory === c.id ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${editCategory === c.id ? c.color : 'rgba(255,255,255,0.07)'}`,
                  }}>{c.name}</button>
              ))}
            </div>
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
        <div className="flex items-center gap-3" style={{ padding: '14px 16px', background: 'var(--bg-card)' }}>
          {/* Checkbox */}
          <button
            onClick={() => store.toggleItem(list.id, item)}
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
              border: `2px solid ${item.completed ? 'var(--accent)' : 'var(--border-2)'}`,
              background: item.completed ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 180ms ease', cursor: 'pointer',
            }}
          >
            {item.completed && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
          </button>

          {/* Title area — tap to edit */}
          <div
            onClick={() => { if (!item.completed) { cancelEdit(); startEdit(item) } }}
            style={{ flex: 1, minWidth: 0, cursor: item.completed ? 'default' : 'pointer' }}
          >
            <div className="flex items-center gap-2">
              {cat && <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0, display: 'inline-block' }} />}
              <span style={{
                fontSize: 15, fontWeight: 500,
                color: item.completed ? 'var(--text-3)' : 'var(--text)',
                textDecoration: item.completed ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 200ms ease',
              }}>{item.title}</span>
              {dupeIds.has(item.id) && !isEditing && (
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 600,
                  color: '#d97706', background: 'rgba(217,119,6,0.12)',
                  border: '0.5px solid #fcd34d', borderRadius: 99, padding: '2px 6px',
                }}>Dup</span>
              )}
            </div>
            {cat && showCategories && (
              <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, marginTop: 1, display: 'block' }}>{cat.name}</span>
            )}
            {(item.added_by_name || item.completed_by_name) && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, display: 'block' }}>
                {item.completed ? `✓ ${item.completed_by_name}` : `by ${item.added_by_name}`}
              </span>
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
                  textAlign: 'center', background: 'rgba(0,212,255,0.08)', border: '1.5px solid var(--accent)',
                  boxShadow: '0 0 0 3px rgba(0,212,255,0.12)',
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
  const sheetStyle: React.CSSProperties = {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480,
    background: 'rgba(5, 11, 22, 0.97)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderTop: '1px solid rgba(0, 212, 255, 0.16)',
    borderRadius: '24px 24px 0 0',
    zIndex: 101, animation: 'slide-up 0.3s cubic-bezier(0.22,1,0.36,1)',
    paddingBottom: 'env(safe-area-inset-bottom, 16px)',
    boxShadow: '0 -12px 60px rgba(0,0,0,0.75)',
  }
  const overlay = <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 }} />
  const handle  = <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,212,255,0.22)', margin: '14px auto 6px' }} />
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    color: 'var(--text-3)', textTransform: 'uppercase',
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {list.emoji} {list.name}
          </p>
          {items.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>
              {items.filter(i => i.completed).length} of {items.length} done
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
            <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 6 }}>{members.length} members</span>
          </div>
        )}

        {/* Progress bar */}
        {items.length > 0 && (
          <div style={{ padding: '12px 16px 8px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {Math.round(pct)}% · {pending.length} {pending.length === 1 ? 'item left' : 'items left'}
              </span>
            </div>
            <div className="progress-bar" style={{ height: 6 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: isAllComplete ? '#22c55e' : 'var(--accent)' }} />
            </div>
          </div>
        )}

        {/* Category filter strip */}
        {list.type === 'shopping' && usedCatIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
            <button onClick={() => setFilterCategories(new Set())} style={{
              flexShrink: 0, padding: '5px 14px', borderRadius: 99, cursor: 'pointer',
              background: filterCategories.size === 0 ? 'var(--accent)' : 'transparent',
              color: filterCategories.size === 0 ? '#030a14' : 'var(--text-2)',
              border: filterCategories.size === 0 ? 'none' : '1px solid var(--border-2)',
              fontSize: 13, fontWeight: filterCategories.size === 0 ? 700 : 500,
              boxShadow: filterCategories.size === 0 ? '0 0 10px rgba(0,212,255,0.35)' : 'none',
            }}>All</button>
            {cats.filter(c => usedCatIds.has(c.id)).map(c => {
              const active = filterCategories.has(c.id)
              return (
                <button key={c.id} onClick={() => setFilterCategories(prev => {
                  const next = new Set(prev); active ? next.delete(c.id) : next.add(c.id); return next
                })} style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: 99, cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#030a14' : 'var(--text-2)',
                  border: active ? 'none' : '1px solid var(--border-2)',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  boxShadow: active ? '0 0 10px rgba(0,212,255,0.35)' : 'none',
                }}>{c.name}</button>
              )
            })}
          </div>
        )}

        {/* Duplicate banner */}
        {dupeGroups.size > 0 && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
              borderRadius: 10, background: 'rgba(217,119,6,0.08)', border: '0.5px solid #fcd34d',
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#d97706' }}>
                {dupeIds.size} items appear more than once
              </span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {store.lastError && (
          <div className="error-msg" style={{ margin: '0 16px 8px' }}>
            {store.lastError}
            <button onClick={store.clearError} style={{ float: 'right', fontWeight: 700, background: 'none', color: '#dc2626', fontSize: 16 }}>✕</button>
          </div>
        )}

        <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>All done! 🎉</p>
                  {completionTime && <p className="text-sm text-muted" style={{ margin: '0 0 14px' }}>Completed {formatCompletedAt(completionTime)}</p>}
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <button onClick={() => { setShowAdd(true); setTimeout(() => addInputRef.current?.focus(), 80) }}
                      className="btn btn-primary btn-sm"><Plus size={14} /> Add more</button>
                    <button disabled={unchecking} onClick={async () => { setUnchecking(true); await store.uncheckAll(list.id); setUnchecking(false) }}
                      className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
                      <RefreshCw size={13} style={unchecking ? { animation: 'spin 1s linear infinite' } : {}} /> Reset
                    </button>
                    {isOwner && <button onClick={() => setShareOpen(true)} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
                      <Share2 size={13} /> Share
                    </button>}
                  </div>
                </div>
              )}

              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <div className="flex items-center justify-between" style={{ margin: '4px 2px 0' }}>
                    <span style={sectionLabel}>Pending · {pending.length}</span>
                    {list.type === 'shopping' && cats.length > 0 && (
                      <button onClick={() => setShowCategories(v => !v)} style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                        border: `1px solid ${showCategories ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                        background: showCategories ? 'rgba(22,163,74,0.08)' : 'transparent',
                        color: showCategories ? 'var(--accent)' : 'var(--text-3)',
                      }}>{showCategories ? 'Hide Categories' : 'Show Categories'}</button>
                    )}
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
                    <span style={sectionLabel}>Completed · {completed.length}</span>
                    <button onClick={() => setShowCompleted(v => !v)}
                      style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer' }}>
                      {showCompleted ? 'Hide ↑' : 'Show ↓'}
                    </button>
                  </div>
                  {showCompleted && (
                    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.8 }}>
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

      {/* FAB */}
      <button className="fab" onClick={() => { setShowAdd(true); setTimeout(() => addInputRef.current?.focus(), 80) }}>
        <Plus size={24} />
      </button>

      {/* ── Add Item Sheet ── */}
      {showAdd && (
        <>
          {React.createElement('div', {
            onClick: () => { resetAdd(); setShowAdd(false) },
            style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 },
          })}
          <div style={sheetStyle}>
            {handle}
            <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    background: 'rgba(5, 11, 22, 0.98)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(0,212,255,0.15)', marginTop: 4,
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

              {/* Category chips */}
              {cats.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cats.map(c => {
                    const active = addCategory === c.id
                    return (
                      <button key={c.id}
                        onClick={() => { setAddCategory(active ? null : c.id); setAddCatSticky(true) }}
                        style={{
                          padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: active ? c.color : 'var(--bg-input)',
                          color: active ? '#fff' : 'var(--text-2)',
                          border: `1px solid ${active ? c.color : 'rgba(255,255,255,0.08)'}`,
                          transition: 'all 0.15s',
                        }}>{c.name}</button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Merge confirm ── */}
      {showMerge && mergeTarget && pendingAdd && (
        <>
          {overlay}
          <div style={sheetStyle}>
            {handle}
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>"{mergeTarget.title}" already exists</p>
              <p className="text-muted text-sm">
                Existing: <strong>{mergeTarget.quantity || '—'}</strong> · Adding: <strong>{pendingAdd.qty}</strong> → Combined: <strong>{mergeQuantities(mergeTarget.quantity, pendingAdd.qty)}</strong>
              </p>
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={async () => { await store.addItem(list.id, pendingAdd.title, pendingAdd.qty, pendingAdd.category); setShowMerge(false); setMergeTarget(null); resetAdd() }}>Add Separate</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMerge}>Merge Qty</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Menu ── */}
      {menuOpen && (
        <>
          {React.createElement('div', { onClick: () => setMenuOpen(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
          <div style={sheetStyle}>
            {handle}
            <div style={{ padding: '8px 0 8px' }}>
              {[
                { icon: <ArrowUpDown size={16} />, label: 'Sort', hint: sortMode === 'alpha' ? 'A → Z' : sortMode === 'category' ? 'Category' : 'Date added', action: () => { setMenuOpen(false); setSortMenuOpen(true) } },
                { icon: <BarChart2 size={16} />, label: 'Insights', hint: '', action: () => { setMenuOpen(false); setInsightsOpen(true) } },
                { icon: <Pencil size={16} />, label: 'Rename', hint: '', action: () => { setRenameValue(list.name); setMenuOpen(false); setRenaming(true); setTimeout(() => renameRef.current?.focus(), 80) } },
                isOwner ? { icon: <Share2 size={16} />, label: 'Share', hint: '', action: () => { setMenuOpen(false); setShareOpen(true) } } : null,
                { icon: <Check size={16} />, label: `Clear Completed${completed.length > 0 ? ` (${completed.length})` : ''}`, hint: '', action: async () => { setMenuOpen(false); setUnchecking(true); await store.uncheckAll(list.id); setUnchecking(false) }, disabled: completed.length === 0 },
                isOwner ? { icon: <Trash2 size={16} color="#ef4444" />, label: 'Delete List', hint: '', action: () => { setMenuOpen(false); setConfirmDelete(true) }, danger: true } : null,
              ].filter(Boolean).map((item, i) => {
                const it = item as { icon: React.ReactNode; label: string; hint: string; action: () => void; disabled?: boolean; danger?: boolean }
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
          {React.createElement('div', { onClick: () => setSortMenuOpen(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
          <div style={sheetStyle}>
            {handle}
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
          {React.createElement('div', { onClick: () => setRenaming(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
          <div style={sheetStyle}>
            {handle}
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
          {React.createElement('div', { onClick: () => setConfirmDelete(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
          <div style={sheetStyle}>
            {handle}
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

      {/* ── Insights sheet ── */}
      {insightsOpen && (() => {
        const total = items.length
        const done  = items.filter(i => i.completed).length
        const pctDone = total > 0 ? Math.round((done / total) * 100) : 0

        // Category breakdown
        const catStats = cats.map(c => {
          const catItems = items.filter(i => i.category === c.id)
          const catDone  = catItems.filter(i => i.completed).length
          return { ...c, total: catItems.length, done: catDone }
        }).filter(c => c.total > 0)
        const uncategorised = items.filter(i => !i.category)
        const uncatDone = uncategorised.filter(i => i.completed).length

        // Member activity
        const memberAdded: Record<string, number>     = {}
        const memberCompleted: Record<string, number> = {}
        items.forEach(i => {
          if (i.added_by_name)     memberAdded[i.added_by_name]     = (memberAdded[i.added_by_name] || 0) + 1
          if (i.completed_by_name) memberCompleted[i.completed_by_name] = (memberCompleted[i.completed_by_name] || 0) + 1
        })
        const topAdder    = Object.entries(memberAdded).sort((a,b) => b[1]-a[1])[0]
        const topCompleter = Object.entries(memberCompleted).sort((a,b) => b[1]-a[1])[0]

        return (
          <>
            {React.createElement('div', { onClick: () => setInsightsOpen(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
            <div style={{ ...sheetStyle, maxHeight: '85vh', overflowY: 'auto' }}>
              {handle}
              <div style={{ padding: '10px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Insights · {list.emoji} {list.name}</p>

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Total', value: total, color: 'var(--text)' },
                    { label: 'Done',  value: done,  color: '#16a34a' },
                    { label: 'Left',  value: total - done, color: total - done > 0 ? '#d97706' : 'var(--text-3)' },
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
                {total > 0 && (
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Progress</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: pctDone === 100 ? '#16a34a' : 'var(--accent)' }}>{pctDone}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${pctDone}%`, background: pctDone === 100 ? '#16a34a' : 'var(--accent)', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )}

                {/* Category breakdown */}
                {(catStats.length > 0 || uncategorised.length > 0) && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>By Category</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {catStats.map(c => {
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
                      {uncategorised.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Uncategorised</span>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{uncatDone}/{uncategorised.length} · {uncategorised.length > 0 ? Math.round((uncatDone/uncategorised.length)*100) : 0}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, width: `${uncategorised.length > 0 ? Math.round((uncatDone/uncategorised.length)*100) : 0}%`, background: 'var(--text-3)', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Member activity */}
                {(topAdder || topCompleter) && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Member Activity</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {topAdder && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: `hsl(${(topAdder[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{topAdder[0][0]?.toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topAdder[0]}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Added {topAdder[1]} item{topAdder[1] !== 1 ? 's' : ''}</p>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>Top Adder</span>
                        </div>
                      )}
                      {topCompleter && topCompleter[0] !== topAdder?.[0] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: `hsl(${(topCompleter[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{topCompleter[0][0]?.toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topCompleter[0]}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Checked off {topCompleter[1]} item{topCompleter[1] !== 1 ? 's' : ''}</p>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Top Completer</span>
                        </div>
                      )}
                      {topCompleter && topCompleter[0] === topAdder?.[0] && (
                        <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '4px 0' }}>
                          {topAdder[0]} is leading on both adding and completing! 🏆
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {total === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, padding: '16px 0' }}>Add some items to see insights.</p>
                )}

                <button className="btn btn-secondary btn-full" onClick={() => setInsightsOpen(false)}>Close</button>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Share sheet ── */}
      {shareOpen && (
        <>
          {React.createElement('div', { onClick: () => setShareOpen(false), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 100 } })}
          <div style={sheetStyle}>
            {handle}
            <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Share List</p>
              <p className="text-muted text-sm">Anyone with this link can join and collaborate — no account needed.</p>
              <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '12px 14px', wordBreak: 'break-all', fontSize: 13, color: 'var(--text-2)' }}>
                {window.location.origin}/join/{list.invite_code}
              </div>
              <button className="btn btn-primary btn-full" onClick={copyLink}>
                {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Link</>}
              </button>
              {isOwner && (
                <button className="btn btn-ghost btn-full text-sm text-muted"
                  onClick={async () => { await store.regenerateInvite(list.id); setShareOpen(false) }}>
                  Generate new link (revokes old one)
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Undo delete toast ── */}
      {undoItem && (
        <div style={{
          position: 'fixed', bottom: 84, left: 16, right: 16, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(5, 11, 22, 0.96)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,212,255,0.20)',
          borderRadius: 16, padding: '13px 16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,212,255,0.06)',
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

// Need React in scope for createElement calls
import React from 'react'
