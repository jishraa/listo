import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, UserCircle, RefreshCw, Pin, ArrowUp, Copy, Pencil, Trash2, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import CreateListSheet from '../components/lists/CreateListSheet'
import Sheet from '../components/ui/Sheet'
import { formatRelativeTime } from '../lib/utils'
import type { ListType, List } from '../types'

function ListCard({
  list, isOwner, isPinned, onOpen, onPin, onMoveTop, onRename, onDuplicate, onDelete, onLeave, items,
}: {
  list: List; isOwner: boolean; isPinned: boolean; items: { completed: boolean }[]
  onOpen: () => void; onPin: () => void; onMoveTop: () => void
  onRename: () => void; onDuplicate: () => void; onDelete: () => void; onLeave: () => void
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
          ...(isPinned && { borderColor: 'rgba(0,212,255,0.28)', boxShadow: '0 0 0 1px rgba(0,212,255,0.10)' }),
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
              {isPinned && <Pin size={11} color="var(--accent)" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.6))' }} />}
              <span style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{list.name}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm" style={{ color: allDone ? '#00e087' : 'var(--text-2)', fontWeight: allDone ? 600 : 400 }}>
                {total === 0 ? 'Empty' : allDone ? '✓ All done' : `${done}/${total} done`}
              </span>
              <span className="text-xs text-hint">{formatRelativeTime(list.updated_at)}</span>
            </div>
            {total > 0 && (
              <div className="progress-bar mt-2">
                <div className="progress-fill" style={{
                  width: `${pct}%`,
                  background: allDone ? '#00e087' : 'var(--accent)',
                  boxShadow: allDone ? '0 0 8px rgba(0,224,135,0.55)' : '0 0 8px rgba(0,212,255,0.55)',
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
          <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onPin(); setMenuOpen(false) }}>
            <Pin size={16} /> {isPinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onMoveTop(); setMenuOpen(false) }}>
            <ArrowUp size={16} /> Move to top
          </button>
          {isOwner && <>
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { setMenuOpen(false); onRename() }}>
              <Pencil size={16} /> Rename
            </button>
            <button className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onDuplicate(); setMenuOpen(false) }}>
              <Copy size={16} /> Duplicate
            </button>
            <button className="btn btn-danger btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { setMenuOpen(false); onDelete() }}>
              <Trash2 size={16} /> Delete list
            </button>
          </>}
          {!isOwner && (
            <button className="btn btn-danger btn-full" style={{ justifyContent: 'flex-start', gap: 12 }} onClick={() => { onLeave(); setMenuOpen(false) }}>
              <LogOut size={16} /> Leave list
            </button>
          )}
        </div>
      </Sheet>
    </>
  )
}

export default function Home() {
  const { user, displayName } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<List | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const [showOwnCompleted, setShowOwnCompleted] = useState(false)
  const [showSharedCompleted, setShowSharedCompleted] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const name = (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
    store.init(user.id, name || displayName)
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    try {
      const pins = JSON.parse(localStorage.getItem(`listo-pins-${user.id}`) ?? '[]') as string[]
      const order = JSON.parse(localStorage.getItem(`listo-order-${user.id}`) ?? '[]') as string[]
      setPinnedIds(new Set(pins))
      setCustomOrder(order)
    } catch { /* ignore */ }
  }, [user?.id])

  useEffect(() => {
    for (const list of store.lists) {
      if (!store.items[list.id]) store.loadItems(list.id)
      if (!store.members[list.id]) store.loadMembers(list.id)
    }
  }, [store.lists.length])

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

  const ownLists = store.lists.filter(l => l.owner_id === user?.id)
  const sharedLists = store.lists.filter(l => l.owner_id !== user?.id)
  const hasLists = ownLists.length > 0 || sharedLists.length > 0

  const byRecent = (a: List, b: List) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

  const sortOwn = (lists: List[]) => {
    const remaining = [...lists]
    const ordered: List[] = []
    for (const id of customOrder) {
      const idx = remaining.findIndex(l => l.id === id)
      if (idx !== -1) ordered.push(...remaining.splice(idx, 1))
    }
    remaining.sort(byRecent)
    const all = [...ordered, ...remaining]
    return [...all.filter(l => pinnedIds.has(l.id)), ...all.filter(l => !pinnedIds.has(l.id))]
  }

  const isAllDone = (listId: string) => {
    const its = store.items[listId] ?? []
    return its.length > 0 && its.every(i => i.completed)
  }

  const q = search.trim().toLowerCase()
  const filteredOwn = q ? ownLists.filter(l => l.name.toLowerCase().includes(q)) : ownLists
  const filteredShared = q ? sharedLists.filter(l => l.name.toLowerCase().includes(q)) : sharedLists

  const activeOwn = sortOwn(filteredOwn).filter(l => !isAllDone(l.id))
  const completedOwn = sortOwn(filteredOwn).filter(l => isAllDone(l.id))
  const activeShared = [...filteredShared].sort(byRecent).filter(l => !isAllDone(l.id))
  const completedShared = [...filteredShared].sort(byRecent).filter(l => isAllDone(l.id))

  const firstName = displayName.split(' ')[0] || 'there'

  const renderCard = (list: List, isOwner: boolean) => (
    <ListCard
      key={list.id}
      list={list}
      isOwner={isOwner}
      isPinned={pinnedIds.has(list.id)}
      items={store.items[list.id] ?? []}
      onOpen={() => navigate(`/list/${list.id}`)}
      onPin={() => togglePin(list.id)}
      onMoveTop={() => moveToTop(list.id)}
      onRename={() => { setRenameTarget(list); setRenameInput(list.name) }}
      onDuplicate={() => store.duplicateList(list.id)}
      onDelete={() => setDeleteTarget(list)}
      onLeave={() => store.leaveList(list.id)}
    />
  )

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' as const }

  return (
    <div className="app-container">
      <div className="page">
        <div style={{ padding: '28px 16px 14px' }} className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.04em', marginBottom: 4 }}>
              Hey, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{firstName}</span>
            </p>
            <h2 style={{
              fontSize: 24, fontWeight: 800, letterSpacing: -0.8, marginTop: 0,
              background: 'linear-gradient(130deg, var(--text) 40%, var(--text-2) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Your Lists</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => store.refreshLists()}
              style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}>
              <RefreshCw size={17} color="var(--text-2)" />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}
              style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}>
              <UserCircle size={24} color="var(--text-2)" />
            </button>
          </div>
        </div>

        {hasLists && (
          <div style={{ padding: '0 16px 12px' }}>
            <input className="input" placeholder="Search lists…" value={search} onChange={e => setSearch(e.target.value)} />
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
              {q && filteredOwn.length === 0 && filteredShared.length === 0 ? (
                <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '24px 0' }}>No lists match "<strong>{search}</strong>"</p>
              ) : (
                <>
                  {activeOwn.map(l => renderCard(l, true))}

                  {completedOwn.length > 0 && (
                    <>
                      <div className="flex items-center justify-between" style={{ padding: '4px 2px 0' }}>
                        <span style={sectionLabel}>Completed · {completedOwn.length}</span>
                        <button onClick={() => setShowOwnCompleted(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer' }}>
                          {showOwnCompleted ? 'Hide ↑' : 'Show ↓'}
                        </button>
                      </div>
                      {showOwnCompleted && completedOwn.map(l => <div key={l.id} style={{ opacity: 0.6 }}>{renderCard(l, true)}</div>)}
                    </>
                  )}

                  {(activeShared.length > 0 || completedShared.length > 0) && (
                    <>
                      <span style={{ ...sectionLabel, padding: '8px 2px 0', display: 'block' }}>Shared with me</span>
                      {activeShared.map(l => renderCard(l, false))}
                      {completedShared.length > 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span style={sectionLabel}>Completed · {completedShared.length}</span>
                            <button onClick={() => setShowSharedCompleted(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer' }}>
                              {showSharedCompleted ? 'Hide ↑' : 'Show ↓'}
                            </button>
                          </div>
                          {showSharedCompleted && completedShared.map(l => <div key={l.id} style={{ opacity: 0.6 }}>{renderCard(l, false)}</div>)}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {hasLists && <button className="fab" onClick={() => setCreateOpen(true)}><Plus size={24} /></button>}

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

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
    </div>
  )
}
