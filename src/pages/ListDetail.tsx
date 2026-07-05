import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowUpDown, Eye, Sparkles, Check, Copy, FileText, LayoutTemplate, MoreVertical, Pencil, Plus, RefreshCw, Share2, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import type { ListItem } from '../types'
import { parseItemInput, detectCategoryIn } from '../lib/constants'
import { friendlyName, formatRelativeTime, capitalize } from '../lib/utils'
import { useCategoriesStore } from '../store/useCategoriesStore'
import { useMemoryStore, regularsOf } from '../store/useMemoryStore'
import { exportListReport } from '../lib/report'
import { openYft } from '../lib/yft'
import { SwipeRow } from '../components/lists/SwipeRow'
import ShareListSheet from '../components/lists/ShareListSheet'
import CategoryPickerSheet from '../components/lists/CategoryPickerSheet'
import ShoppingInsights from '../components/lists/ShoppingInsights'
import DuplicateReviewSheet from '../components/lists/DuplicateReviewSheet'
import AddItemSheet from '../components/lists/AddItemSheet'
import { useEnsureData } from '../hooks/useEnsureData'

type SortMode = 'date' | 'alpha' | 'category'

// Category filter pill — 36px, non-truncating; soft green tint when active so
// the strongest Listo green stays reserved for CTAs/progress (spec §1.1–1.2).
function pillStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 18, cursor: 'pointer',
    whiteSpace: 'nowrap', border: 'none',
    background: active ? 'var(--accent-soft)' : 'var(--bg-input)',
    color: active ? 'var(--accent-text)' : 'var(--text-2)',
    fontSize: 13, fontWeight: active ? 700 : 500,
    transition: 'background 160ms ease, color 160ms ease',
  }
}

// Per-list view preferences (spec §4.2) — persisted under listo-view-<id>
// only while "remember" is on; otherwise they last for the session.
type ViewPrefs = { categories: boolean; addedBy: boolean; autoExpand: boolean; remember: boolean }
const DEFAULT_VIEW_PREFS: ViewPrefs = { categories: true, addedBy: true, autoExpand: false, remember: true }
function readViewPrefs(id: string | undefined): ViewPrefs {
  if (!id) return DEFAULT_VIEW_PREFS
  try {
    const raw = localStorage.getItem(`listo-view-${id}`)
    if (raw) return { ...DEFAULT_VIEW_PREFS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_VIEW_PREFS
}

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

function Overlay({ onClick }: { onClick?: () => void }) {
  return <div className="sheet-overlay" onClick={onClick} />
}

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = useListsStore()
  const { user, displayName } = useAuthStore()
  // Drill-in page renders outside AppShell — on a direct load / refresh the
  // lists store is empty and the page would hang on "Loading…" forever.
  useEnsureData()

  const list    = store.lists.find(l => l.id === id)
  const rawItems = list ? store.items[list.id] : undefined
  const items   = rawItems ?? []
  const members = list ? (store.members[list.id] ?? []) : []
  const isOwner = !!list && list.owner_id === user?.id
  // A viewer can see the list but never write to it (RLS-enforced; the UI hides
  // the controls to match). We gate on positively-knowing the user is a viewer,
  // so owners/collaborators aren't briefly locked out before members load —
  // the database is the real boundary regardless.
  const myRole = list ? store.myRole(list.id) : null
  const isViewer = myRole === 'viewer'
  const canEdit = !isViewer

  // ── Add sheet (extracted to AddItemSheet) ───────────────────
  const [showAdd, setShowAdd] = useState(false)

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
  const [showCompleted,    setShowCompleted]    = useState(() => readViewPrefs(id).autoExpand)
  const [viewPrefs,        setViewPrefs]        = useState<ViewPrefs>(() => readViewPrefs(id))
  const [customizeOpen,    setCustomizeOpen]    = useState(false)
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())

  function updateViewPref(patch: Partial<ViewPrefs>) {
    setViewPrefs(prev => {
      const next = { ...prev, ...patch }
      if (id) {
        if (next.remember) localStorage.setItem(`listo-view-${id}`, JSON.stringify(next))
        else localStorage.removeItem(`listo-view-${id}`)
      }
      if ('autoExpand' in patch) setShowCompleted(next.autoExpand)
      return next
    })
  }
  // Category picker for the inline row-edit flow (the add flow has its own)
  const [editPickerOpen,   setEditPickerOpen]   = useState(false)
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

  // List Memory — "your regulars" to seed a fresh list in one tap.
  const memHistory = useMemoryStore(s => s.history)
  const regulars = useMemo(() => regularsOf(memHistory, new Set(), 8), [memHistory])
  const addRegular = (m: { name: string; category: string | null; lastQuantity: string | null }) => {
    if (!list) return
    store.addItem(list.id, m.name, m.lastQuantity ?? '', m.category ?? detectCategoryIn(cats, m.name) ?? null)
  }

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

  // Latest change by another member — a subtle shared-list activity hint
  // ("Anjana added Milk · 2m ago"), not a full activity feed (additions §6).
  const lastActivity = useMemo(() => {
    if (members.length < 2) return null
    let best: { who: string; verb: string; what: string; at: string } | null = null
    for (const i of items) {
      if (i.added_by_name && i.added_by_name !== displayName && (!best || i.created_at > best.at)) {
        best = { who: i.added_by_name, verb: 'added', what: i.title, at: i.created_at }
      }
      if (i.completed && i.completed_by_name && i.completed_by_name !== displayName && i.completed_at && (!best || i.completed_at > best.at)) {
        best = { who: i.completed_by_name, verb: 'completed', what: i.title, at: i.completed_at }
      }
    }
    // Only surface recent activity (last 24h) — older isn't "news"
    if (!best || Date.now() - new Date(best.at).getTime() > 86_400_000) return null
    return `${friendlyName(best.who)} ${best.verb} ${best.what} · ${formatRelativeTime(best.at)}`
  }, [items, members.length, displayName])

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
    const raw = editTitle.trim()
    if (!raw) { cancelEdit(); return }
    // A quantity typed into the title ("Milk 2") is extracted, not stored as
    // part of the name; the explicit qty field wins when both are set.
    const parsed = parseItemInput(raw)
    const t = capitalize(parsed.item)
    const qty = editQty.trim() || parsed.qty || null
    if (t === item.title && qty === item.quantity && editCategory === item.category) { cancelEdit(); return }
    await store.updateItem(list!.id, item.id, { title: t, quantity: qty, category: editCategory })
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
              onClick={() => setEditPickerOpen(true)}
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
      <SwipeRow key={item.id} onDelete={() => handleDelete(item)} disabled={!canEdit}>
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
            onClick={() => { if (canEdit) store.toggleItem(list.id, item) }}
            disabled={!canEdit}
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
            style={{
              flexShrink: 0, width: 40, height: 40, margin: -9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default',
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
            onClick={() => { if (canEdit && !item.completed) { cancelEdit(); startEdit(item) } }}
            style={{ flex: 1, minWidth: 0, cursor: canEdit && !item.completed ? 'pointer' : 'default' }}
          >
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 17, fontWeight: 600,
                color: item.completed ? 'var(--text-3)' : 'var(--text)',
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
            {(() => {
              // Metadata row respects the per-list view prefs (spec §4.2).
              // "Category · Member" — friendly names, "You" for own items.
              const showCat = cat && viewPrefs.categories
              const person = (n: string) => n === displayName ? 'You' : friendlyName(n)
              const rawWho = !viewPrefs.addedBy ? null : item.completed
                ? (item.completed_by_name ? `✓ ${person(item.completed_by_name)}` : null)
                : (members.length > 1 && item.added_by_name ? person(item.added_by_name) : null)
              const who = rawWho && showCat && !item.completed ? `· ${rawWho}` : rawWho
              if (!showCat && !who) return null
              return (
                <div className="flex items-center" style={{ gap: 6, marginTop: 3 }}>
                  {showCat && (
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 600, lineHeight: 1,
                      padding: '3px 7px', borderRadius: 6,
                      background: item.completed ? 'var(--bg-input)' : `${cat!.color}1f`,
                      color: item.completed ? 'var(--text-3)' : 'var(--text-2)',
                    }}>{cat!.name}</span>
                  )}
                  {who && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Qty chip (shopping only) — shown only when a meaningful quantity
              exists (no "—" placeholder, no ×1); qty is set via the item text
              ("Milk 2") or the edit flow */}
          {list.type === 'shopping' && !item.completed && (item.quantity || qtyEditId === item.id) && (
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
                onClick={e => { e.stopPropagation(); if (canEdit) { setQtyDraft(item.quantity ?? ''); setQtyEditId(item.id) } }}
                disabled={!canEdit}
                style={{
                  flexShrink: 0, padding: '3px 9px', borderRadius: 99,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default',
                  color: 'var(--text-2)',
                }}
              >{item.quantity}</button>
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


  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronLeft size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 7, minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {list.name}
            </p>
            {isViewer && (
              <span style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                padding: '2px 8px', borderRadius: 99,
              }}>
                <Eye size={12} /> View only
              </span>
            )}
          </div>
          {/* Live remaining-count under the title — the single source of the
              "items left" info (spec §1.3), shown for personal and shared alike */}
          {items.length > 0 && (
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
              {[...members]
                .sort((a, b) => (a.user_id === user?.id ? -1 : b.user_id === user?.id ? 1 : 0))
                .map(m => m.user_id === user?.id ? 'You' : friendlyName(m.display_name)).join(', ')}
            </span>
          </div>
        )}

        {/* Subtle shared-list activity hint — no heavy feed (additions §6) */}
        {lastActivity && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, padding: '5px 16px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lastActivity}
          </p>
        )}

        {/* Compact contextual progress (spec §1–2): one line + 4px bar,
            bar hidden until something is completed */}
        {items.length > 0 && (
          <div style={{ padding: '10px 16px 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: doneCount > 0 ? 6 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isAllComplete ? 'var(--accent)' : 'var(--text-2)' }}>
                {progressMsg}
              </span>
              {/* Only the % here — "N items left" already lives in the header
                  (spec §1.3, no repetition) */}
              {!isAllComplete && doneCount > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                  {Math.round(pct)}%
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

        {/* Category filter strip — horizontally scrollable, labels never
            truncate or wrap (spec §1.1); soft green tint when active (§1.2) */}
        {list.type === 'shopping' && usedCatIds.size > 0 && (
          <div className="cat-filter-strip" style={{ display: 'flex', gap: 8, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
            <button onClick={() => setFilterCategories(new Set())} style={pillStyle(filterCategories.size === 0)}>All</button>
            {cats.filter(c => usedCatIds.has(c.id)).map(c => {
              const active = filterCategories.has(c.id)
              return (
                <button key={c.id} onClick={() => setFilterCategories(prev => {
                  const next = new Set(prev); active ? next.delete(c.id) : next.add(c.id); return next
                })} style={pillStyle(active)}>{c.name}</button>
              )
            })}
          </div>
        )}

        {/* Smart banner (spec §4/§16) — one at a time, only when actionable.
            Viewers can't act on duplicates/categories, so no banner for them. */}
        {!canEdit ? null : dupeGroups.size > 0 ? (
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
            <>
              <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36 }}>{list.emoji}</div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{canEdit ? 'Ready to start?' : 'Nothing here yet'}</p>
                <p className="text-muted text-sm">
                  {!canEdit ? 'Items added by the group will show up here.'
                    : list.type === 'shopping' ? 'Add your first grocery item.' : list.type === 'tasks' ? 'Add your first task.' : 'Add your first item.'}
                </p>
              </div>

              {/* List Memory: one-tap add the user's regulars to a fresh list */}
              {canEdit && regulars.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <p style={sectionLabel}>Your regulars</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {regulars.map(m => (
                      <button
                        key={m.nameKey}
                        onClick={() => addRegular(m)}
                        style={{
                          height: 34, padding: '0 13px', borderRadius: 17, cursor: 'pointer',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          fontSize: 13, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap',
                        }}
                      >
                        + {m.name}{m.lastQuantity ? ` ${m.lastQuantity}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
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
                    <Sparkles size={15} /> View Insights
                  </button>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {canEdit && <button onClick={() => setShowAdd(true)}
                      className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}><Plus size={14} /> Add more</button>}
                    {canEdit && <button disabled={unchecking} onClick={async () => { setUnchecking(true); await store.uncheckAll(list.id); setUnchecking(false) }}
                      className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
                      <RefreshCw size={13} style={unchecking ? { animation: 'spin 1s linear infinite' } : {}} /> Reuse list
                    </button>}
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
                    {/* No count here — "N items left" in the header already says it */}
                    <span style={sectionLabel}>Pending</span>
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

      {/* FAB — morphs away while the add sheet is open (spec §7).
          Hidden entirely for viewers, who can't add items. */}
      {canEdit && (
        <button
          className="fab"
          aria-label="Add item"
          onClick={() => setShowAdd(true)}
          style={{
            transform: showAdd ? 'scale(0.5)' : 'none',
            opacity: showAdd ? 0 : 1,
            pointerEvents: showAdd ? 'none' : 'auto',
            transition: 'transform 220ms var(--ease), opacity 220ms var(--ease)',
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── Add Item Sheet (extracted) ── */}
      <AddItemSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        list={list}
        items={items}
        cats={cats}
      />

      {/* ── Menu ── */}
      {menuOpen && (
        <>
          <Overlay onClick={() => setMenuOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '8px 0 8px' }}>
              {[
                { icon: <ArrowUpDown size={16} />, label: 'Sort', hint: sortMode === 'alpha' ? 'A → Z' : sortMode === 'category' ? 'Category' : 'Date added', action: () => { setMenuOpen(false); setSortMenuOpen(true) } },
                list.type === 'shopping' ? { icon: <Sparkles size={16} />, label: 'Insights', hint: '✦', action: () => { setMenuOpen(false); setInsightsOpen(true) } } : null,
                { icon: <SlidersHorizontal size={16} />, label: 'Customize List View', hint: '', action: () => { setMenuOpen(false); setCustomizeOpen(true) } },
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
                    {/* ✦ = the single subtle premium indicator (spec §4.3) */}
                    {it.hint && (
                      <span style={{ fontSize: it.hint === '✦' ? 14 : 12, color: it.hint === '✦' ? 'var(--accent)' : 'var(--text-3)' }}>
                        {it.hint}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Customize List View (spec §4.2) ── */}
      {customizeOpen && (
        <>
          <Overlay onClick={() => setCustomizeOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '6px 20px 22px' }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>Customize List View</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 12px' }}>Choose what shows on each item.</p>
              {([
                { key: 'categories', title: 'Categories', desc: 'Show item categories' },
                { key: 'addedBy', title: 'Added By', desc: 'Show who added each item' },
                { key: 'autoExpand', title: 'Completed Items', desc: 'Automatically expand completed items' },
                { key: 'remember', title: 'Remember for this list', desc: 'Save these choices for next time' },
              ] as const).map(row => {
                const on = viewPrefs[row.key]
                return (
                  <div key={row.key} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{row.title}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '2px 0 0' }}>{row.desc}</p>
                    </div>
                    <button
                      role="switch" aria-checked={on} aria-label={row.title}
                      onClick={() => updateViewPref({ [row.key]: !on })}
                      style={{
                        flexShrink: 0, width: 46, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer',
                        background: on ? 'var(--accent)' : 'var(--bg-input)',
                        position: 'relative', transition: 'background 180ms ease',
                      }}>
                      <span style={{
                        position: 'absolute', top: 3, left: on ? 21 : 3,
                        width: 22, height: 22, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 180ms var(--ease)',
                      }} />
                    </button>
                  </div>
                )
              })}
              <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => setCustomizeOpen(false)}>Done</button>
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

      {/* ── Insights (full screen, redesign spec) ── */}
      {insightsOpen && (
        <ShoppingInsights
          list={list}
          items={items}
          members={members}
          displayName={displayName}
          onClose={() => setInsightsOpen(false)}
          onCategorize={() => {
            setInsightsOpen(false)
            if (uncategorizedPending[0]) { cancelEdit(); startEdit(uncategorizedPending[0]) }
          }}
          onReviewDuplicates={() => { setInsightsOpen(false); setDupeReviewOpen(true) }}
        />
      )}

      {/* ── Share sheet ── */}
      {shareOpen && (
        <ShareListSheet list={list} members={members} onClose={() => setShareOpen(false)} />
      )}

      {/* ── Category picker (row-edit flow) ── */}
      <CategoryPickerSheet
        open={editPickerOpen}
        categories={cats}
        selected={editCategory}
        onSelect={id => setEditCategory(id)}
        onClose={() => setEditPickerOpen(false)}
      />

      {/* ── Duplicate review (extracted; spec §4) ── */}
      <DuplicateReviewSheet
        open={dupeReviewOpen}
        onClose={() => setDupeReviewOpen(false)}
        list={list}
        groups={dupeGroups}
        shared={members.length > 1}
      />

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
