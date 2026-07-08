import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowUpDown, ChevronDown, ChevronLeft, Copy, Eye, FileText, LayoutTemplate, MoreVertical, Pencil, Plus, Share2, ShoppingBag, ShoppingCart, Sparkles, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import type { ListItem } from '../types'
import { parseItemInput, detectCategoryIn } from '../lib/constants'
import { friendlyName, formatRelativeTime, capitalize } from '../lib/utils'
import { storageKeys, writeJSON } from '../lib/storage'
import { useCategoriesStore } from '../store/useCategoriesStore'
import { useMemoryStore, regularsOf, forgottenRegulars, memoryKey } from '../store/useMemoryStore'
import { pendingDuplicateGroups } from '../lib/duplicates'
import { exportListReport } from '../lib/report'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import Avatar from '../components/ui/Avatar'
import PullIndicator from '../components/ui/PullIndicator'
import ShareListSheet from '../components/lists/ShareListSheet'
import CategoryPickerSheet from '../components/lists/CategoryPickerSheet'
import ShoppingInsights from '../features/insights/ShoppingInsights'
import DuplicateReviewSheet from '../components/lists/DuplicateReviewSheet'
import AddItemSheet from '../components/lists/AddItemSheet'
import BeforeYouGoSheet from '../components/lists/BeforeYouGoSheet'
import ShopMode from '../components/lists/ShopMode'
import NextTripSheet from '../components/lists/NextTripSheet'
import { useEnsureData } from '../hooks/useEnsureData'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
// Feature module: presentation lives in features/list-detail, this page
// orchestrates state, data, and which pieces are visible.
import {
  type SortMode, type ViewPrefs,
  pillStyle, sectionLabel, readViewPrefs, readKeptDupes, beforeYouGoAutoShown,
} from '../features/list-detail/helpers'
import ItemRow from '../features/list-detail/ItemRow'
import ItemEditRow from '../features/list-detail/ItemEditRow'
import CompletionCard from '../features/list-detail/CompletionCard'
import EmptyItems from '../features/list-detail/EmptyItems'
import SmartBanners from '../features/list-detail/SmartBanners'
import ListOptionsMenu, { type MenuGroupSpec } from '../features/list-detail/ListOptionsMenu'
import CompletedItemSheet from '../features/list-detail/CompletedItemSheet'
import SortSheet from '../features/list-detail/SortSheet'
import CustomizeViewSheet from '../features/list-detail/CustomizeViewSheet'
import RenameSheet from '../features/list-detail/RenameSheet'

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

  // ── Edit state — shared with the category picker and the completed-item
  //    action sheet, so it lives here rather than in ItemEditRow ───────────
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editTitle,    setEditTitle]    = useState('')
  const [editQty,      setEditQty]      = useState('')
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)

  // ── UI state ────────────────────────────────────────────────
  const [menuOpen,         setMenuOpen]         = useState(false)
  const [sortMenuOpen,     setSortMenuOpen]     = useState(false)
  const [insightsOpen,     setInsightsOpen]     = useState(false)
  const [shareOpen,        setShareOpen]        = useState(false)
  const [renaming,         setRenaming]         = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmClearDone, setConfirmClearDone] = useState(false)
  const [showCompleted,    setShowCompleted]    = useState(() => readViewPrefs(id).autoExpand)
  const [viewPrefs,        setViewPrefs]        = useState<ViewPrefs>(() => readViewPrefs(id))
  const [customizeOpen,    setCustomizeOpen]    = useState(false)
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
  // Tapping a completed item opens a small action sheet (Add Again / Move to
  // Pending / Edit / Delete) rather than mutating it directly.
  const [completedAction,  setCompletedAction]  = useState<ListItem | null>(null)

  function updateViewPref(patch: Partial<ViewPrefs>) {
    setViewPrefs(prev => {
      const next = { ...prev, ...patch }
      if (id) {
        if (next.remember) writeJSON(storageKeys.viewPrefs(id), next)
        else localStorage.removeItem(storageKeys.viewPrefs(id))
      }
      if ('autoExpand' in patch) setShowCompleted(next.autoExpand)
      return next
    })
  }
  // Category picker for the inline row-edit flow (the add flow has its own)
  const [editPickerOpen,   setEditPickerOpen]   = useState(false)
  const [dupeReviewOpen,   setDupeReviewOpen]   = useState(false)
  const [undoItem,         setUndoItem]         = useState<ListItem | null>(null)
  const [completionTime,   setCompletionTime]   = useState<string | null>(() =>
    id ? localStorage.getItem(storageKeys.completedAt(id)) : null
  )
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (!id) return 'date'
    const s = localStorage.getItem(storageKeys.listSort(id))
    return (s === 'alpha' || s === 'category') ? s : 'date'
  })
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manual refresh alongside realtime — covers dropped subscriptions and
  // member/role changes, which don't push (items are the only realtime feed).
  const pull = usePullToRefresh(async () => {
    if (!id) return
    await Promise.all([store.loadItems(id), store.loadMembers(id)])
  })

  useEffect(() => {
    if (!id) return
    store.loadItems(id)
    store.loadMembers(id)
    const unsub = store.subscribeToList(id)
    return unsub
  }, [id])

  useEffect(() => { if (id) localStorage.setItem(storageKeys.listSort(id), sortMode) }, [id, sortMode])

  const isAllComplete = items.length > 0 && items.every(i => i.completed)
  useEffect(() => {
    if (!id) return
    if (isAllComplete) {
      if (!completionTime) {
        const t = new Date().toISOString()
        setCompletionTime(t)
        localStorage.setItem(storageKeys.completedAt(id), t)
      }
    } else if (completionTime) {
      setCompletionTime(null)
      localStorage.removeItem(storageKeys.completedAt(id))
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

  const [shopModeOpen, setShopModeOpen] = useState(false)
  const [nextTripOpen, setNextTripOpen] = useState(false)

  // "Before you go" — regulars not on this list yet (present = pending + done).
  const [beforeYouGoOpen, setBeforeYouGoOpen] = useState(false)
  const forgotten = useMemo(() => {
    const present = new Set(items.map(i => memoryKey(i.title)))
    return forgottenRegulars(memHistory, present, 6)
  }, [memHistory, items])

  // Auto-nudge on the transition to fully complete: a shopping trip is
  // wrapping up, so surface forgotten regulars once (never repeatedly).
  const prevAllComplete = useRef<boolean | null>(null)
  useEffect(() => {
    const was = prevAllComplete.current
    prevAllComplete.current = isAllComplete
    if (was === false && isAllComplete && list && list.type === 'shopping' && canEdit
        && forgotten.length > 0 && !beforeYouGoAutoShown.has(list.id)) {
      beforeYouGoAutoShown.add(list.id)
      setBeforeYouGoOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllComplete])
  const addRegular = (m: { name: string; category: string | null; lastQuantity: string | null }) => {
    if (!list) return
    store.addItem(list.id, m.name, m.lastQuantity ?? '', m.category ?? detectCategoryIn(cats, m.name) ?? null)
  }

  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])

  // Completion summary — what the finished trip covered (from data in render).
  const tripSummary = useMemo(() => {
    const byCat = new Map<string, number>()
    let uncategorized = 0
    for (const i of items) {
      if (i.category && catById.has(i.category)) byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1)
      else uncategorized++
    }
    const chips = [...byCat.entries()]
      .map(([id, n]) => ({ cat: catById.get(id)!, n }))
      .sort((a, b) => b.n - a.n)
    return { count: items.length, aisles: byCat.size + (uncategorized > 0 ? 1 : 0), chips }
  }, [items, catById])

  const usedCatIds = useMemo(() => {
    const s = new Set<string>()
    items.forEach(i => { if (i.category) s.add(i.category) })
    return s
  }, [items])

  // Duplicate detection
  // Blocking duplicate detection runs ONLY against pending items — completed
  // items are past purchases and must never trigger review (see lib/duplicates).
  // Groups the user has chosen to "Keep both" are remembered per list so the
  // banner stops nagging about intentional repeats.
  const [keptDupes, setKeptDupes] = useState<Set<string>>(new Set())
  useEffect(() => { setKeptDupes(new Set(readKeptDupes(id))) }, [id])
  const keepDupe = useCallback((key: string) => {
    setKeptDupes(prev => {
      const next = new Set(prev).add(key)
      if (id) writeJSON(storageKeys.keptDupes(id), [...next])
      return next
    })
  }, [id])
  const dupeGroups = useMemo(() => {
    const g = pendingDuplicateGroups(items)
    keptDupes.forEach(k => g.delete(k))
    return g
  }, [items, keptDupes])
  const dupeIds = useMemo(() => {
    const s = new Set<string>(); dupeGroups.forEach(g => g.forEach(i => s.add(i.id))); return s
  }, [dupeGroups])
  // Orphaned ids (category deleted in /categories) count as uncategorized too,
  // so the "Categorize" banner can offer to re-label them.
  const uncategorizedPending = useMemo(
    () => items.filter(i => !i.completed && (!i.category || !catById.has(i.category))), [items, catById]
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

  if (!list) {
    // Lists are loaded but this id isn't among them: deleted, revoked access,
    // or a stale link. Show a way out instead of loading forever.
    const notFound = store.initialized && !store.loading
    return (
      <div className="app-container">
        <div className="header">
          <button className="btn btn-ghost btn-sm" aria-label="Go back" onClick={() => navigate('/')}><ChevronLeft size={20} /></button>
          <span className="header-title">{notFound ? 'List not found' : 'Loading…'}</span>
        </div>
        {notFound ? (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h3>This list isn't available</h3>
            <p>It may have been deleted, or it's no longer shared with you.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/', { replace: true })}>Go to My Lists</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        )}
      </div>
    )
  }

  // ── Render item row (edit-in-place or display) ──────────────
  const renderItem = (item: ListItem) => {
    if (editingId === item.id) {
      const editCat = editCategory ? catById.get(editCategory) ?? null : null
      return (
        <ItemEditRow
          key={item.id}
          listType={list.type}
          hasCategories={cats.length > 0}
          category={editCat}
          title={editTitle}
          qty={editQty}
          onTitleChange={setEditTitle}
          onQtyChange={setEditQty}
          onOpenCategoryPicker={() => setEditPickerOpen(true)}
          onCommit={() => commitEdit(item)}
          onCancel={cancelEdit}
          onDelete={() => { cancelEdit(); handleDelete(item) }}
          titleRef={editTitleRef}
        />
      )
    }
    return (
      <ItemRow
        key={item.id}
        item={item}
        listType={list.type}
        canEdit={canEdit}
        isFinalItem={lastItemLeft && !item.completed}
        isDup={dupeIds.has(item.id)}
        cat={item.category ? catById.get(item.category) ?? null : null}
        showCategory={viewPrefs.categories}
        showAddedBy={viewPrefs.addedBy}
        isSharedList={members.length > 1}
        displayName={displayName}
        onToggle={() => store.toggleItem(list.id, item)}
        onOpen={() => {
          if (item.completed) setCompletedAction(item)
          else { cancelEdit(); startEdit(item) }
        }}
        onDelete={() => handleDelete(item)}
        onSaveQty={qty => store.updateItem(list.id, item.id, { title: item.title, quantity: qty, category: item.category })}
      />
    )
  }

  // ── List Options menu, grouped + context-aware (spec §6–§20) ──
  // Actions only appear when relevant to the list's type and state, so the
  // sheet stays short. Empty groups are dropped when rendering.
  const sortHint = sortMode === 'alpha' ? 'A → Z' : sortMode === 'category' ? 'Category' : 'Date added'
  const closeMenu = () => setMenuOpen(false)
  const menuGroups: MenuGroupSpec[] = [
    { label: 'View & Tools', rows: [
      { icon: <ArrowUpDown size={16} />, label: 'Sort', right: sortHint, onClick: () => { closeMenu(); setSortMenuOpen(true) } },
      ...(list.type === 'shopping' ? [{ icon: <Sparkles size={16} />, label: 'Insights', onClick: () => { closeMenu(); setInsightsOpen(true) } }] : []),
      // Shop Mode is reached from the header action, so it's not repeated here.
      // Shopping-only, and only once there are forgotten regulars to suggest (§11)
      ...(list.type === 'shopping' && canEdit && forgotten.length > 0 ? [{ icon: <ShoppingBag size={16} />, label: 'Before You Go', onClick: () => { closeMenu(); setBeforeYouGoOpen(true) } }] : []),
      { icon: <SlidersHorizontal size={16} />, label: 'Customize List View', onClick: () => { closeMenu(); setCustomizeOpen(true) } },
    ]},
    { label: 'Manage List', rows: [
      { icon: <Pencil size={16} />, label: 'Rename', onClick: () => { closeMenu(); setRenaming(true) } },
      ...(isOwner ? [{ icon: <Copy size={16} />, label: 'Duplicate', onClick: async () => { closeMenu(); await store.duplicateList(list.id) } }] : []),
      ...(isOwner ? [{ icon: <LayoutTemplate size={16} />, label: 'Save as Template', onClick: async () => { closeMenu(); await store.saveAsTemplate(list.id) } }] : []),
      ...(isOwner ? [{ icon: <Share2 size={16} />, label: 'Share', onClick: () => { closeMenu(); setShareOpen(true) } }] : []),
    ]},
    // Reports only when there's reportable data (§14); Cleanup only with completed items (§15)
    { label: 'Reports', rows: items.length > 0 ? [
      { icon: <FileText size={16} />, label: 'Export Report', onClick: async () => { closeMenu(); await exportListReport(list, items, members) } },
    ] : [] },
    // Clear Completed permanently deletes checked-off items (confirmed first).
    // Counted from all items, not the category-filtered view.
    { label: 'Cleanup', rows: doneCount > 0 ? [
      { icon: <Trash2 size={16} />, label: 'Clear Completed', right: String(doneCount), onClick: () => { closeMenu(); setConfirmClearDone(true) } },
    ] : [] },
    { label: 'Danger Zone', rows: isOwner ? [
      { icon: <Trash2 size={16} />, label: 'Delete List', danger: true, onClick: () => { closeMenu(); setConfirmDelete(true) } },
    ] : [] },
  ]

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <button className="btn btn-ghost btn-sm" aria-label="Back to lists" onClick={() => navigate('/')}><ChevronLeft size={20} /></button>
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
        {list.type === 'shopping' && canEdit && items.length > 0 && (
          <button className="btn btn-ghost btn-sm" aria-label="Shop Mode" onClick={() => setShopModeOpen(true)}>
            <ShoppingCart size={20} />
          </button>
        )}
        <button className="btn btn-ghost btn-sm" aria-label="List options" onClick={() => setMenuOpen(true)}><MoreVertical size={20} /></button>
      </div>

      <div className="page" ref={pull.scrollRef} {...pull.handlers}>
        <PullIndicator pullY={pull.pullY} isRefreshing={pull.isRefreshing} />
        {/* Member avatars */}
        {members.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px 0' }}>
            {members.slice(0, 5).map((m, i) => (
              <Avatar
                key={m.id}
                name={m.display_name}
                size={22}
                saturation={55}
                lightness={45}
                style={{ border: '2px solid var(--bg-card)', marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 5 - i }}
              />
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
          <div style={{ padding: '10px 16px 20px' }}>
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
          <div className="cat-filter-strip" role="group" aria-label="Filter by category" style={{ display: 'flex', gap: 8, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
            <button aria-pressed={filterCategories.size === 0} onClick={() => setFilterCategories(new Set())} style={pillStyle(filterCategories.size === 0)}>All</button>
            {cats.filter(c => usedCatIds.has(c.id)).map(c => {
              const active = filterCategories.has(c.id)
              return (
                <button key={c.id} aria-pressed={active} onClick={() => setFilterCategories(prev => {
                  const next = new Set(prev); active ? next.delete(c.id) : next.add(c.id); return next
                })} style={pillStyle(active)}>{c.name}</button>
              )
            })}
          </div>
        )}

        {/* Smart banner — viewers can't act on duplicates/categories */}
        {canEdit && (
          <SmartBanners
            isShopping={list.type === 'shopping'}
            dupeCount={dupeGroups.size}
            uncatCount={uncategorizedPending.length}
            onReviewDupes={() => setDupeReviewOpen(true)}
            onCategorize={() => { cancelEdit(); startEdit(uncategorizedPending[0]) }}
          />
        )}

        {/* Error banner */}
        {store.lastError && (
          <div className="error-msg" role="alert" style={{ margin: '0 16px 8px' }}>
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
            <EmptyItems
              listType={list.type}
              canEdit={canEdit}
              regulars={regulars}
              onAddItem={() => setShowAdd(true)}
              onAddRegular={addRegular}
            />
          ) : (
            <>
              {isAllComplete && (
                <CompletionCard
                  list={list}
                  tripSummary={tripSummary}
                  completionTime={completionTime}
                  canEdit={canEdit}
                  isOwner={isOwner}
                  onViewInsights={() => setInsightsOpen(true)}
                  onAddMore={() => setShowAdd(true)}
                  onNextTrip={() => setNextTripOpen(true)}
                  onShare={() => setShareOpen(true)}
                />
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

              {/* Completed — the whole header row is the toggle (no button-like
                  Hide/Show control); a chevron rotates with the state. */}
              {completed.length > 0 && (
                <>
                  <button
                    className="completed-toggle"
                    aria-expanded={showCompleted}
                    onClick={() => setShowCompleted(v => !v)}
                  >
                    <span style={sectionLabel}>Completed ({completed.length})</span>
                    <ChevronDown
                      size={18}
                      style={{ color: 'var(--text-3)', transition: 'transform 200ms var(--ease)', transform: showCompleted ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  {showCompleted && (
                    // Readable, secondary — not blanket-dimmed like a disabled block.
                    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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

      {/* ── Sheets & overlays ── */}
      <AddItemSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        list={list}
        items={items}
        cats={cats}
      />

      <CompletedItemSheet
        item={completedAction}
        onClose={() => setCompletedAction(null)}
        onAddAgain={it => store.addItem(list.id, it.title, it.quantity ?? '', it.category)}
        onMoveToPending={it => store.toggleItem(list.id, it)}
        onEdit={it => { cancelEdit(); startEdit(it); setTimeout(() => editTitleRef.current?.focus(), 80) }}
        onDelete={handleDelete}
      />

      <BeforeYouGoSheet
        open={beforeYouGoOpen}
        onClose={() => setBeforeYouGoOpen(false)}
        list={list}
        cats={cats}
        suggestions={forgotten}
      />

      <ShopMode
        open={shopModeOpen}
        onClose={() => setShopModeOpen(false)}
        list={list}
        items={items}
        cats={cats}
      />

      <NextTripSheet
        open={nextTripOpen}
        onClose={() => setNextTripOpen(false)}
        list={list}
        items={items}
        cats={cats}
        regulars={regulars}
      />

      <ListOptionsMenu open={menuOpen} onClose={closeMenu} groups={menuGroups} />

      <CustomizeViewSheet
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        prefs={viewPrefs}
        onChange={updateViewPref}
      />

      <SortSheet
        open={sortMenuOpen}
        sortMode={sortMode}
        onSelect={mode => { setSortMode(mode); setSortMenuOpen(false) }}
        onClose={() => setSortMenuOpen(false)}
      />

      <RenameSheet
        open={renaming}
        currentName={list.name}
        onClose={() => setRenaming(false)}
        onRename={name => store.renameList(list.id, name)}
      />

      {/* ── Clear Completed confirm ── */}
      <ConfirmSheet
        open={confirmClearDone}
        onClose={() => setConfirmClearDone(false)}
        title={`Delete ${doneCount} completed ${doneCount === 1 ? 'item' : 'items'}?`}
        confirmLabel="Delete"
        onConfirm={async () => { setConfirmClearDone(false); await store.deleteCompleted(list.id) }}
      >
        They'll be removed from the list for everyone. This can't be undone.
      </ConfirmSheet>

      {/* ── Delete confirm ── */}
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this list?"
        confirmLabel="Delete List"
        onConfirm={async () => { setConfirmDelete(false); await store.deleteList(list.id); navigate('/') }}
      >
        "<strong>{list.name}</strong>" and all its items will be removed for everyone with access. This can't be undone.
      </ConfirmSheet>

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
        onKeep={keepDupe}
      />

      {/* ── Undo delete toast ── */}
      {undoItem && (
        <div role="status" aria-live="polite" style={{
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
