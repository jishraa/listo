import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, ListChecks } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore, visibleLists } from '../store/useListsStore'
import CreateListSheet from '../components/lists/CreateListSheet'
import InstallBanner from '../components/InstallBanner'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { formatRelativeTime } from '../lib/utils'
import type { ListType } from '../types'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { displayName } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()
  const installPrompt = useInstallPrompt()
  const [createOpen, setCreateOpen] = useState(false)

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    const list = await store.createList({ name, type, emoji })
    if (!list) return
    if (templateItems?.length) {
      for (const item of templateItems) {
        await store.addItem(list.id, item.title, '', item.category ?? null)
      }
    }
  }

  const visible = visibleLists(store.lists)
  const activeLists = visible.filter(l => {
    const items = store.items[l.id] ?? []
    return items.length === 0 || items.some(i => !i.completed)
  })
  const pendingItems = visible.reduce(
    (n, l) => n + (store.items[l.id] ?? []).filter(i => !i.completed).length, 0,
  )
  const recent = [...visible]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  const firstName = displayName.trim().split(' ')[0] || 'there'
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' as const }

  return (
    <>
      <div className="page">
        {/* Greeting header */}
        <div style={{ padding: '24px 16px 4px' }}>
          <p className="text-sm" style={{ color: 'var(--text-3)', marginBottom: 4 }}>{today}</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
            {greeting()}, {firstName}
          </h1>
        </div>

        <InstallBanner {...installPrompt} />

        <div className="page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {store.loading ? (
            <div className="flex-col gap-3">
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 'var(--radius)' }} />)}
            </div>
          ) : (
            <>
              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>{activeLists.length}</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 2 }}>
                    Active {activeLists.length === 1 ? 'list' : 'lists'}
                  </p>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: 26, fontWeight: 800 }}>{pendingItems}</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 2 }}>
                    {pendingItems === 1 ? 'Item' : 'Items'} to do
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <button className="btn btn-primary btn-full" onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> New List
              </button>

              {/* Recent lists */}
              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between" style={{ padding: '0 2px 8px' }}>
                    <span style={sectionLabel}>Recent</span>
                    <button
                      onClick={() => navigate('/lists')}
                      style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', cursor: 'pointer' }}
                    >
                      See all
                    </button>
                  </div>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {recent.map((list, i) => {
                      const items = store.items[list.id] ?? []
                      const done = items.filter(it => it.completed).length
                      return (
                        <button
                          key={list.id}
                          onClick={() => navigate(`/list/${list.id}`)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '13px 16px', textAlign: 'left', cursor: 'pointer',
                            borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{list.emoji}</span>
                          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }} className="truncate">
                            {list.name}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                            {items.length === 0 ? formatRelativeTime(list.updated_at) : `${done}/${items.length}`}
                          </span>
                          <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {visible.length === 0 && !store.loadError && (
                <div className="empty-state">
                  <div className="icon">📋</div>
                  <h3>Welcome to Listo</h3>
                  <p>Create your first list to get started.</p>
                </div>
              )}

              {/* Placeholder for insights quick cards (needs insights engine) */}
              {visible.length > 0 && (
                <button
                  onClick={() => navigate('/insights')}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <ListChecks size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Shopping Insights</span>
                  <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
    </>
  )
}
