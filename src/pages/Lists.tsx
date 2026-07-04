import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Share2, Search, X, Pin, Trash2, LogOut, Archive, ArchiveRestore, ArrowUpDown, Check, Users, Sparkles, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore, visibleLists, templateLists, archivedLists } from '../store/useListsStore'
import CreateListSheet from '../components/lists/CreateListSheet'
import ShareListSheet from '../components/lists/ShareListSheet'
import { SwipeCard } from '../components/lists/SwipeCard'
import type { SwipeAction } from '../components/lists/SwipeCard'
import Sheet from '../components/ui/Sheet'
import InstallBanner from '../components/InstallBanner'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { formatRelativeTime, friendlyName } from '../lib/utils'
import { useCategoriesStore } from '../store/useCategoriesStore'
import type { ListType, List } from '../types'

type Filter = 'active' | 'shared' | 'completed' | 'archived'
type Sort = 'recent' | 'alpha' | 'created' | 'items' | 'progress'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active',    label: 'Active' },
  { id: 'shared',    label: 'Shared' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived',  label: 'Archived' },
]

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent',   label: 'Recently Updated' },
  { id: 'alpha',    label: 'Alphabetical' },
  { id: 'created',  label: 'Recently Created' },
  { id: 'items',    label: 'Most Items' },
  { id: 'progress', label: 'Least Progress' },
]

const SORT_KEY = 'listo-lists-sort'

function ListCard({ list, isPinned, onOpen, items, collab }: {
  list: List; isPinned: boolean; items: { completed: boolean }[]
  // Consolidated collaborator label (names or "N members"); undefined = personal
  collab?: string
  onOpen: () => void
}) {
  const total = items.length
  const done = items.filter(i => i.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total
  const left = total - done
  // Actionable status, no fractions (spec §4): users shouldn't have to
  // calculate what's remaining. Untouched lists just state their size.
  const status =
    total === 0 ? 'Empty'
    : allDone ? '✓ Done'
    : done === 0 ? `${total} ${total === 1 ? 'item' : 'items'}`
    : `${left} ${left === 1 ? 'item' : 'items'} left`

  const typeBgClass = { personal: 'type-bg-personal', tasks: 'type-bg-tasks', shopping: 'type-bg-shopping' }[list.type]

  return (
    <div className="card card-press" style={{ padding: '16px', cursor: 'pointer' }} onClick={onOpen}>
      <div className="flex items-center gap-3">
        <div className={typeBgClass} style={{
          width: 46, height: 46, borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>
          {list.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 1 — List name, with the done/total count pinned right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              {isPinned && <Pin size={11} color="var(--accent)" fill="var(--accent)" style={{ flexShrink: 0 }} />}
              <span style={{ fontWeight: 600, fontSize: 17 }} className="truncate">{list.name}</span>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 12.5, fontWeight: allDone ? 700 : 600,
              color: allDone ? '#00e087' : 'var(--text-3)',
            }}>
              {status}
            </span>
          </div>
          {/* 2 — Collaboration · updated time, one non-wrapping line */}
          <div className="flex items-center" style={{ gap: 5, marginTop: 4, minWidth: 0 }}>
            {collab && <Users size={12} color="var(--text-3)" style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {collab ? `${collab} · ${formatRelativeTime(list.updated_at)}` : `Updated ${formatRelativeTime(list.updated_at)}`}
            </span>
          </div>
          {/* 3 — Progress, inset to the content column; only rendered once
              progress has started — no empty bars at 0% (spec §progress) */}
          {done > 0 && (
            <div className="progress-bar" style={{ marginTop: 9, height: 7 }}>
              <div className="progress-fill" style={{
                width: `${pct}%`,
                background: allDone ? '#00e087' : 'var(--accent)',
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Lists() {
  const { user } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()
  const installPrompt = useInstallPrompt()

  const pageRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollTop = pageRef.current?.scrollTop ?? 0
    if (scrollTop > 0 || isRefreshing) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullY(Math.min(delta * 0.55, 72))
  }

  const handleTouchEnd = async () => {
    if (pullY >= 60) {
      setIsRefreshing(true)
      setPullY(0)
      await store.refreshLists()
      setIsRefreshing(false)
    } else {
      setPullY(0)
    }
  }

  // Category display names (user-customized) for search matching
  const allCategories = useCategoriesStore(s2 => s2.categories)
  const categoryNames = useMemo(
    () => new Map(Object.values(allCategories).flat().map(c => [c.id, c.name.toLowerCase()])),
    [allCategories],
  )

  // ?filter=shared etc. lets other screens (e.g. Profile) deep-link a view
  const [searchParams] = useSearchParams()
  const urlFilter = searchParams.get('filter')

  const [shareTarget, setShareTarget] = useState<List | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<'templates' | 'custom'>('templates')
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [filter, setFilter] = useState<Filter>(
    () => FILTERS.some(f => f.id === urlFilter) ? urlFilter as Filter : 'active'
  )
  // Last sort choice is remembered across visits (spec §3)
  const [sort, setSort] = useState<Sort>(() => {
    const st = localStorage.getItem(SORT_KEY)
    return SORTS.some(o => o.id === st) ? st as Sort : 'recent'
  })
  const [sortOpen, setSortOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    try {
      const pins = JSON.parse(localStorage.getItem(`listo-pins-${user.id}`) ?? '[]') as string[]
      const order = JSON.parse(localStorage.getItem(`listo-order-${user.id}`) ?? '[]') as string[]
      setPinnedIds(new Set(pins))
      setCustomOrder(order)
    } catch { /* ignore */ }
  }, [user?.id])

  const togglePin = (listId: string) => {
    const next = new Set(pinnedIds)
    next.has(listId) ? next.delete(listId) : next.add(listId)
    setPinnedIds(next)
    localStorage.setItem(`listo-pins-${user?.id}`, JSON.stringify([...next]))
  }

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    const list = await store.createList({ name, type, emoji })
    if (!list) return
    if (templateItems?.length) {
      for (const item of templateItems) {
        await store.addItem(list.id, item.title, '', item.category ?? null)
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await store.deleteList(deleteTarget.id)
    setDeleteTarget(null)
  }


  const visible = visibleLists(store.lists)
  const templates = templateLists(store.lists)
  const archived = archivedLists(store.lists)
  const hasLists = store.lists.length > 0

  const byRecent = (a: List, b: List) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

  const comparator: Record<Sort, (a: List, b: List) => number> = {
    recent:  byRecent,
    alpha:   (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    created: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    items:   (a, b) => (store.items[b.id]?.length ?? 0) - (store.items[a.id]?.length ?? 0),
    progress: (a, b) => {
      const pct = (l: List) => {
        const its = store.items[l.id] ?? []
        return its.length === 0 ? 1 : its.filter(i => i.completed).length / its.length
      }
      return pct(a) - pct(b)
    },
  }

  // Pins always float; the user's manual order only applies in Recent mode
  // (an explicit sort choice overrides it).
  const applySort = (lists: List[]) => {
    let all: List[]
    if (sort === 'recent') {
      const remaining = [...lists]
      const ordered: List[] = []
      for (const id of customOrder) {
        const idx = remaining.findIndex(l => l.id === id)
        if (idx !== -1) ordered.push(...remaining.splice(idx, 1))
      }
      remaining.sort(byRecent)
      all = [...ordered, ...remaining]
    } else {
      all = [...lists].sort(comparator[sort])
    }
    return [...all.filter(l => pinnedIds.has(l.id)), ...all.filter(l => !pinnedIds.has(l.id))]
  }

  const isAllDone = (listId: string) => {
    const its = store.items[listId] ?? []
    return its.length > 0 && its.every(i => i.completed)
  }

  // Search across list name, member names, and item category names (spec)
  const q = search.trim().toLowerCase()
  const matches = (l: List) => {
    if (!q) return true
    if (l.name.toLowerCase().includes(q)) return true
    if ((store.members[l.id] ?? []).some(m => m.display_name.toLowerCase().includes(q))) return true
    return (store.items[l.id] ?? []).some(i => i.category && categoryNames.get(i.category)?.includes(q))
  }

  const activeCount = visible.filter(l => !isAllDone(l.id)).length
  const sharedCount = visible.filter(l => l.owner_id !== user?.id).length
  const headerSummary = `${activeCount} active${sharedCount > 0 ? ` · ${sharedCount} shared` : ''}`

  const activeAll    = applySort(visible.filter(l => !isAllDone(l.id) && matches(l)))
  const completedAll = applySort(visible.filter(l => isAllDone(l.id) && matches(l)))
  const sharedAll    = applySort(visible.filter(l => l.owner_id !== user?.id && matches(l)))
  const archivedAll  = applySort(archived.filter(matches))
  const templatesFiltered = templates.filter(matches)

  // Collaborator label for the card's metadata line (spec): one other member
  // shows their friendly name ("Anjana", never "anjana1995ks"); more than one
  // collapses to "N members". undefined ⇒ personal list.
  const collabLabelFor = (list: List): string | undefined => {
    const mem = store.members[list.id] ?? []
    if (mem.length < 2) return undefined
    const others = mem.filter(m => m.user_id !== user?.id).map(m => m.display_name).filter(Boolean)
    if (others.length === 0) return undefined
    if (others.length === 1) return `Shared with ${friendlyName(others[0])}`
    return `${mem.length} members`
  }

  const renderCard = (list: List) => {
    const isOwner = list.owner_id === user?.id
    const swipeLeft: SwipeAction[] = [
      { label: pinnedIds.has(list.id) ? 'Unpin' : 'Pin', icon: <Pin size={16} />, color: '#475569', onPress: () => togglePin(list.id) },
      ...(isOwner ? [{ label: 'Share', icon: <Share2 size={16} />, color: '#16A34A', onPress: () => setShareTarget(list) }] : []),
    ]
    const swipeRight: SwipeAction[] = isOwner
      ? [
          { label: 'Archive', icon: <Archive size={16} />, color: '#475569', onPress: () => store.setArchived(list.id, true) },
          { label: 'Delete',  icon: <Trash2 size={16} />,  color: '#EF4444', onPress: () => setDeleteTarget(list) },
        ]
      : [{ label: 'Leave', icon: <LogOut size={16} />, color: '#EF4444', onPress: () => store.leaveList(list.id) }]
    return (
      <SwipeCard key={list.id} leftActions={swipeLeft} rightActions={swipeRight}>
        <ListCard
          list={list}
          isPinned={pinnedIds.has(list.id)}
          items={store.items[list.id] ?? []}
          collab={collabLabelFor(list)}
          onOpen={() => navigate(`/list/${list.id}`)}
        />
      </SwipeCard>
    )
  }

  // Templates open in ListDetail, where rename/delete live in the header menu.
  const renderTemplate = (list: List) => (
    <ListCard
      key={list.id}
      list={list}
      isPinned={false}
      items={store.items[list.id] ?? []}
      onOpen={() => navigate(`/list/${list.id}`)}
    />
  )

  // Archived cards stay swipeable so restore/delete remain reachable without a menu.
  const renderArchived = (list: List) => {
    const isOwner = list.owner_id === user?.id
    const rightActions: SwipeAction[] = isOwner
      ? [
          { label: 'Restore', icon: <ArchiveRestore size={16} />, color: '#16A34A', onPress: () => store.setArchived(list.id, false) },
          { label: 'Delete',  icon: <Trash2 size={16} />,         color: '#EF4444', onPress: () => setDeleteTarget(list) },
        ]
      : [{ label: 'Leave', icon: <LogOut size={16} />, color: '#EF4444', onPress: () => store.leaveList(list.id) }]
    return (
      <SwipeCard key={list.id} leftActions={[]} rightActions={rightActions}>
        <ListCard
          list={list}
          isPinned={false}
          items={store.items[list.id] ?? []}
          collab={collabLabelFor(list)}
          onOpen={() => navigate(`/list/${list.id}`)}
        />
      </SwipeCard>
    )
  }

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-2)', textTransform: 'uppercase' as const }

  return (
    <>
      <div
        className="page"
        ref={pageRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullY > 0 || isRefreshing) && (
          <div style={{
            height: isRefreshing ? 56 : pullY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', transition: isRefreshing ? 'none' : 'height 0.15s ease',
          }}>
            <div className={isRefreshing ? 'spinner' : undefined} style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid var(--accent)', borderTopColor: 'transparent',
              transform: isRefreshing ? undefined : `rotate(${pullY * 5}deg)`,
              opacity: Math.min(pullY / 40, 1),
            }} />
          </div>
        )}

        {/* Header — counts give context (spec §1) */}
        <div style={{ padding: '20px 16px 12px' }} className="flex items-center justify-between">
          <div>
            <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.6, display: 'block' }}>Lists</span>
            {hasLists && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, display: 'block' }}>
                {headerSummary}
              </span>
            )}
          </div>
          {hasLists && (
            <div className="flex items-center" style={{ gap: 2 }}>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Sort lists"
                style={{ padding: 8, borderRadius: 10, color: sort !== 'recent' ? 'var(--accent)' : 'var(--text-2)' }}
                onClick={() => setSortOpen(true)}
              >
                <ArrowUpDown size={18} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Search lists"
                style={{ padding: 8, borderRadius: 10, color: searchOpen ? 'var(--accent)' : 'var(--text-2)' }}
                onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearch('') }}
              >
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </div>
          )}
        </div>

        <InstallBanner {...installPrompt} />

        {hasLists && searchOpen && (
          <div style={{ padding: '0 16px 12px' }}>
            <input className="input" placeholder="Search by name, member or category…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        )}

        {/* Filter chips — compact, soft-green active state, never truncate;
            strip scrolls horizontally on narrow widths (spec §2) */}
        {hasLists && (
          <div className="flex items-center" style={{ gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
            {FILTERS.map(f => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 99, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                    border: 'none',
                    color: active ? 'var(--accent-text)' : 'var(--text-2)',
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        )}

        <div className="page-padded" style={{ paddingTop: 0 }}>
          {store.lastError && (
            <div className="error-msg" style={{ marginBottom: 12 }}>
              {store.lastError}
              <button onClick={store.clearError} style={{ float: 'right', fontWeight: 700, background: 'none', color: '#dc2626', fontSize: 16 }}>✕</button>
            </div>
          )}

          {store.loading ? (
            <div className="flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 84, borderRadius: 'var(--radius)' }} />)}
            </div>
          ) : store.loadError && !hasLists ? (
            <div className="empty-state">
              <div className="icon">⚠️</div>
              <h3>Couldn't load lists</h3>
              <p>Check your connection and try again.</p>
              <button className="btn btn-primary mt-4" onClick={() => store.refreshLists()}>Retry</button>
            </div>
          ) : !hasLists ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3>No lists yet</h3>
              <p>Create your first list or start from a template.</p>
              <button className="btn btn-primary mt-4" onClick={() => { setCreateStep('custom'); setCreateOpen(true) }}>
                <Plus size={18} /> Create List
              </button>
              <button className="btn btn-secondary mt-2" onClick={() => { setCreateStep('templates'); setCreateOpen(true) }}>
                Browse Templates
              </button>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {filter === 'active' && (
                <>
                  {activeAll.map(renderCard)}
                  {activeAll.length === 0 && (
                    q ? (
                      <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>
                        No lists match "<strong>{search}</strong>"
                      </p>
                    ) : (
                      <div className="empty-state" style={{ padding: '28px 0 12px' }}>
                        <div className="icon">📝</div>
                        <h3>No active lists</h3>
                        <p>Create a list to start planning, shopping, or organizing tasks.</p>
                        <button className="btn btn-primary mt-4" onClick={() => { setCreateStep('custom'); setCreateOpen(true) }}>
                          <Plus size={18} /> Create List
                        </button>
                        <button
                          onClick={() => { setCreateStep('templates'); setCreateOpen(true) }}
                          className="mt-3"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                          Browse Templates →
                        </button>
                      </div>
                    )
                  )}

                  {templatesFiltered.length > 0 && (
                    <>
                      <span style={{ ...sectionLabel, padding: '8px 2px 0', display: 'block' }}>Templates</span>
                      {templatesFiltered.map(renderTemplate)}
                    </>
                  )}

                  {/* Template nudge only while the workspace is nearly empty
                      (1–2 active lists); templates otherwise live behind the
                      + action — never a permanent dashboard card (spec) */}
                  {!q && activeAll.length > 0 && activeAll.length <= 2 && (
                    <button
                      onClick={() => { setCreateStep('templates'); setCreateOpen(true) }}
                      className="card card-press"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Sparkles size={17} color="var(--accent)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600 }}>Need inspiration?</p>
                        <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 2 }}>Browse ready-made templates</p>
                      </div>
                      <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                    </button>
                  )}

                  {completedAll.length > 0 && (
                    <>
                      <div className="flex items-center justify-between" style={{ padding: '8px 2px 0' }}>
                        <span style={sectionLabel}>Completed · {completedAll.length}</span>
                        <button onClick={() => setShowCompleted(v => !v)} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', background: 'none', cursor: 'pointer' }}>
                          {showCompleted ? 'Hide ↑' : 'Show ↓'}
                        </button>
                      </div>
                      {showCompleted && completedAll.map(l => <div key={l.id} style={{ opacity: 0.6 }}>{renderCard(l)}</div>)}
                    </>
                  )}
                </>
              )}

              {filter === 'shared' && (
                sharedAll.length > 0
                  ? sharedAll.map(renderCard)
                  : <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>
                      {q ? <>No shared lists match "<strong>{search}</strong>"</> : 'No lists shared with you yet.'}
                    </p>
              )}

              {filter === 'completed' && (
                completedAll.length > 0
                  ? completedAll.map(l => <div key={l.id} style={{ opacity: 0.7 }}>{renderCard(l)}</div>)
                  : <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>
                      {q ? <>No completed lists match "<strong>{search}</strong>"</> : 'Nothing completed yet — keep going!'}
                    </p>
              )}

              {filter === 'archived' && (
                archivedAll.length > 0
                  ? archivedAll.map(l => <div key={l.id} style={{ opacity: 0.7 }}>{renderArchived(l)}</div>)
                  : <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>
                      {q ? <>No archived lists match "<strong>{search}</strong>"</> : 'No archived lists.'}
                    </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} initialStep={createStep} />

      {shareTarget && (
        <ShareListSheet
          list={shareTarget}
          members={store.members[shareTarget.id] ?? []}
          onClose={() => setShareTarget(null)}
        />
      )}

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <div className="sheet-body" style={{ gap: 8 }}>
          {SORTS.map(s => (
            <button
              key={s.id}
              className="btn btn-secondary btn-full"
              style={{ justifyContent: 'space-between' }}
              onClick={() => { setSort(s.id); localStorage.setItem(SORT_KEY, s.id); setSortOpen(false) }}
            >
              {s.label}
              {sort === s.id && <Check size={16} color="var(--accent)" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Sheet>

      {deleteTarget && (
        <>
          <div className="sheet-overlay" onClick={() => setDeleteTarget(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-body" style={{ textAlign: 'center' }}>
              <Trash2 size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 700, fontSize: 17 }}>Delete "{deleteTarget.name}"?</p>
              <p className="text-muted text-sm mt-2">All items will be permanently deleted.</p>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
