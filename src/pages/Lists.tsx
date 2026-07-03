import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Share2, Search, X, Pin, ArrowUp, Copy, Pencil, Trash2, LogOut, LayoutTemplate, Archive, ArchiveRestore, ArrowUpDown, Check, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore, visibleLists, templateLists, archivedLists } from '../store/useListsStore'
import CreateListSheet from '../components/lists/CreateListSheet'
import ShareListSheet from '../components/lists/ShareListSheet'
import Sheet from '../components/ui/Sheet'
import InstallBanner from '../components/InstallBanner'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { formatRelativeTime } from '../lib/utils'
import { LIST_CATEGORIES } from '../lib/constants'
import type { ListType, List } from '../types'

type Filter = 'active' | 'shared' | 'completed' | 'archived'
type Sort = 'recent' | 'alpha' | 'created' | 'items'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active',    label: 'Active' },
  { id: 'shared',    label: 'Shared' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived',  label: 'Archived' },
]

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent',  label: 'Recently Updated' },
  { id: 'alpha',   label: 'Alphabetical' },
  { id: 'created', label: 'Created Date' },
  { id: 'items',   label: 'Most Items' },
]

// Category display names across all list types, for search matching
const CATEGORY_NAMES = new Map(
  Object.values(LIST_CATEGORIES).flat().map(c => [c.id, c.name.toLowerCase()])
)

function ListCard({
  list, isPinned, onOpen, onPin, onMoveTop, onRename, onDuplicate, onDelete, onLeave, onShare,
  onSaveTemplate, onArchive, onUnarchive, items, membersCount = 0,
}: {
  list: List; isPinned: boolean; items: { completed: boolean }[]; membersCount?: number
  onOpen: () => void
  // Menu actions render only when provided, so each section (active /
  // template / archived) passes just the actions that apply to it.
  onPin?: () => void; onMoveTop?: () => void
  onRename?: () => void; onDuplicate?: () => void; onDelete?: () => void
  onLeave?: () => void; onShare?: () => void
  onSaveTemplate?: () => void; onArchive?: () => void; onUnarchive?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const total = items.length
  const done = items.filter(i => i.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  const typeBgClass = { personal: 'type-bg-personal', tasks: 'type-bg-tasks', shopping: 'type-bg-shopping' }[list.type]

  return (
    <>
      <div
        className="card"
        style={{
          padding: '14px 16px', cursor: 'pointer',
          ...(isPinned && { borderColor: 'rgba(22,163,74,0.28)', boxShadow: '0 0 0 1px rgba(22,163,74,0.10)' }),
          ...(allDone  && !isPinned && { borderColor: 'rgba(0,230,140,0.22)' }),
        }}
        onClick={onOpen}
      >
        <div className="flex items-center gap-3">
          <div className={typeBgClass} style={{
            width: 46, height: 46, borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
          }}>
            {list.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2">
              {isPinned && <Pin size={11} color="var(--accent)" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 4px rgba(22,163,74,0.6))' }} />}
              <span style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{list.name}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm" style={{ color: allDone ? '#00e087' : 'var(--text-2)', fontWeight: allDone ? 600 : 400 }}>
                {total === 0 ? 'Empty' : allDone ? '✓ All done' : `${done}/${total} done`}
              </span>
              <span className="text-xs text-hint flex items-center" style={{ gap: 8 }}>
                {membersCount > 1 && (
                  <span className="flex items-center" style={{ gap: 3 }}>
                    <Users size={11} /> {membersCount}
                  </span>
                )}
                {formatRelativeTime(list.updated_at)}
              </span>
            </div>
            {total > 0 && (
              <div className="progress-bar mt-2">
                <div className="progress-fill" style={{
                  width: `${pct}%`,
                  background: allDone ? '#00e087' : 'var(--accent)',
                  boxShadow: allDone ? '0 0 8px rgba(0,224,135,0.55)' : '0 0 8px rgba(22,163,74,0.55)',
                }} />
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setMenuOpen(true) }}
          >
            <span style={{ fontSize: 20, color: 'var(--text-3)', lineHeight: 1 }}>⋯</span>
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="sheet-body" style={{ paddingTop: 8, gap: 8 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{list.name}</p>
          {onPin && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onPin(); setMenuOpen(false) }}>
              <Pin size={16} /> {isPinned ? 'Unpin' : 'Pin to top'}
            </button>
          )}
          {onMoveTop && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onMoveTop(); setMenuOpen(false) }}>
              <ArrowUp size={16} /> Move to top
            </button>
          )}
          {onShare && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onShare(); setMenuOpen(false) }}>
              <Share2 size={16} /> Share list
            </button>
          )}
          {onRename && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { setMenuOpen(false); onRename() }}>
              <Pencil size={16} /> Rename
            </button>
          )}
          {onDuplicate && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onDuplicate(); setMenuOpen(false) }}>
              <Copy size={16} /> Duplicate
            </button>
          )}
          {onSaveTemplate && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onSaveTemplate(); setMenuOpen(false) }}>
              <LayoutTemplate size={16} /> Save as template
            </button>
          )}
          {onArchive && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onArchive(); setMenuOpen(false) }}>
              <Archive size={16} /> Archive
            </button>
          )}
          {onUnarchive && (
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onUnarchive(); setMenuOpen(false) }}>
              <ArchiveRestore size={16} /> Unarchive
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { setMenuOpen(false); onDelete() }}>
              <Trash2 size={16} /> Delete list
            </button>
          )}
          {onLeave && (
            <button className="btn btn-danger btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onLeave(); setMenuOpen(false) }}>
              <LogOut size={16} /> Leave list
            </button>
          )}
        </div>
      </Sheet>
    </>
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

  const [shareTarget, setShareTarget] = useState<List | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<List | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [sort, setSort] = useState<Sort>('recent')
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

  const moveToTop = (listId: string) => {
    const next = [listId, ...customOrder.filter(id => id !== listId)]
    setCustomOrder(next)
    localStorage.setItem(`listo-order-${user?.id}`, JSON.stringify(next))
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

  const handleRename = async () => {
    if (!renameTarget || !renameInput.trim()) return
    await store.renameList(renameTarget.id, renameInput.trim())
    setRenameTarget(null)
    setRenameInput('')
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
    return (store.items[l.id] ?? []).some(i => i.category && CATEGORY_NAMES.get(i.category)?.includes(q))
  }

  const activeAll    = applySort(visible.filter(l => !isAllDone(l.id) && matches(l)))
  const completedAll = applySort(visible.filter(l => isAllDone(l.id) && matches(l)))
  const sharedAll    = applySort(visible.filter(l => l.owner_id !== user?.id && matches(l)))
  const archivedAll  = applySort(archived.filter(matches))
  const templatesFiltered = templates.filter(matches)

  const renderCard = (list: List) => {
    const isOwner = list.owner_id === user?.id
    return (
      <ListCard
        key={list.id}
        list={list}
        isPinned={pinnedIds.has(list.id)}
        items={store.items[list.id] ?? []}
        membersCount={(store.members[list.id] ?? []).length}
        onOpen={() => navigate(`/list/${list.id}`)}
        onPin={() => togglePin(list.id)}
        onMoveTop={() => moveToTop(list.id)}
        {...(isOwner
          ? {
              // Sharing is owner-only: the sheet rotates the invite code
              onShare: () => setShareTarget(list),
              onRename: () => { setRenameTarget(list); setRenameInput(list.name) },
              onDuplicate: () => store.duplicateList(list.id),
              onSaveTemplate: () => store.saveAsTemplate(list.id),
              onArchive: () => store.setArchived(list.id, true),
              onDelete: () => setDeleteTarget(list),
            }
          : { onLeave: () => store.leaveList(list.id) })}
      />
    )
  }

  // Templates open in ListDetail for item editing; archived cards only restore or delete.
  const renderTemplate = (list: List) => (
    <ListCard
      key={list.id}
      list={list}
      isPinned={false}
      items={store.items[list.id] ?? []}
      onOpen={() => navigate(`/list/${list.id}`)}
      onRename={() => { setRenameTarget(list); setRenameInput(list.name) }}
      onDelete={() => setDeleteTarget(list)}
    />
  )

  const renderArchived = (list: List) => {
    const isOwner = list.owner_id === user?.id
    return (
      <ListCard
        key={list.id}
        list={list}
        isPinned={false}
        items={store.items[list.id] ?? []}
        membersCount={(store.members[list.id] ?? []).length}
        onOpen={() => navigate(`/list/${list.id}`)}
        {...(isOwner
          ? {
              onUnarchive: () => store.setArchived(list.id, false),
              onDelete: () => setDeleteTarget(list),
            }
          : { onLeave: () => store.leaveList(list.id) })}
      />
    )
  }

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' as const }

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

        {/* Header */}
        <div style={{ padding: '20px 16px 14px' }} className="flex items-center justify-between">
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.6 }}>Lists</span>
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

        {/* Filter chips */}
        {hasLists && (
          <div className="flex items-center" style={{ gap: 6, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
            {FILTERS.map(f => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
                    background: active ? 'var(--accent)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    color: active ? '#fff' : 'var(--text-2)',
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
              <button className="btn btn-primary mt-4" onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> Create a List
              </button>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {filter === 'active' && (
                <>
                  {activeAll.map(renderCard)}
                  {activeAll.length === 0 && (
                    <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>
                      {q ? <>No lists match "<strong>{search}</strong>"</> : 'No active lists — everything is done! 🎉'}
                    </p>
                  )}

                  {templatesFiltered.length > 0 && (
                    <>
                      <span style={{ ...sectionLabel, padding: '8px 2px 0', display: 'block' }}>Templates</span>
                      {templatesFiltered.map(renderTemplate)}
                    </>
                  )}

                  {completedAll.length > 0 && (
                    <>
                      <div className="flex items-center justify-between" style={{ padding: '8px 2px 0' }}>
                        <span style={sectionLabel}>Completed · {completedAll.length}</span>
                        <button onClick={() => setShowCompleted(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer' }}>
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

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

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
              onClick={() => { setSort(s.id); setSortOpen(false) }}
            >
              {s.label}
              {sort === s.id && <Check size={16} color="var(--accent)" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename List">
        <div className="sheet-body">
          <input className="input" value={renameInput} onChange={e => setRenameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
          <div className="flex gap-2">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRename} disabled={!renameInput.trim()}>Save</button>
          </div>
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
