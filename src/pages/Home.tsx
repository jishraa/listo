import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, LayoutTemplate, UserPlus, ArrowRight, Tag, Archive, PlusCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore, visibleLists } from '../store/useListsStore'
import CreateListSheet from '../components/lists/CreateListSheet'
import Sheet from '../components/ui/Sheet'
import InstallBanner from '../components/InstallBanner'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { formatRelativeTime } from '../lib/utils'
import type { ListType, List } from '../types'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' as const, padding: '0 2px 8px', display: 'block' }

export default function Home() {
  const { user, displayName } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()
  const installPrompt = useInstallPrompt()
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<'templates' | 'custom'>('custom')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [joining, setJoining] = useState(false)

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    const list = await store.createList({ name, type, emoji })
    if (!list) return
    if (templateItems?.length) {
      for (const item of templateItems) {
        await store.addItem(list.id, item.title, '', item.category ?? null)
      }
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim() || joining) return
    setJoining(true)
    setJoinMsg(null)
    const res = await store.joinByCode(joinCode)
    setJoining(false)
    setJoinMsg({ ok: res.success, text: res.message })
    if (res.success && res.list) {
      setTimeout(() => {
        setJoinOpen(false); setJoinCode(''); setJoinMsg(null)
        navigate(`/list/${res.list!.id}`)
      }, 900)
    }
  }

  const visible = visibleLists(store.lists)
  const pendingOf = (l: List) => (store.items[l.id] ?? []).filter(i => !i.completed).length
  const byRecent = (a: List, b: List) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

  // Today's Focus — one list only. Priority: shopping with pending items,
  // then anything with pending items; most recently updated wins.
  const withPending = visible.filter(l => pendingOf(l) > 0).sort(byRecent)
  const focus = withPending.find(l => l.type === 'shopping') ?? withPending[0] ?? null
  const focusPending = focus ? pendingOf(focus) : 0

  // Smart Insights — only nudges honestly computable today (max 2).
  // Savings / forgot-items / pantry arrive with shopping history.
  const uncategorized = visible
    .filter(l => l.type === 'shopping')
    .flatMap(l => store.items[l.id] ?? [])
    .filter(i => !i.category).length
  const doneList = visible.find(l => {
    const its = store.items[l.id] ?? []
    return l.owner_id === user?.id && its.length > 0 && its.every(i => i.completed)
  })

  // Recent Activity — item additions carry added_by_name + created_at.
  // (Completions have no timestamp yet, so they can't be ordered honestly.)
  const activity = visible
    .flatMap(l => (store.items[l.id] ?? []).map(i => ({ item: i, list: l })))
    .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at))
    .slice(0, 3)

  const firstName = displayName.trim().split(' ')[0] || 'there'
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  const quickAction = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className="card"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 8px', cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
    </button>
  )

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
          ) : visible.length === 0 && !store.loadError ? (
            /* Empty state — primary + secondary CTA per spec */
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3>Welcome to Listo</h3>
              <p>Create your first list or start from a template.</p>
              <button className="btn btn-primary mt-4" onClick={() => { setCreateStep('custom'); setCreateOpen(true) }}>
                <Plus size={18} /> Create List
              </button>
              <button className="btn btn-secondary mt-2" onClick={() => { setCreateStep('templates'); setCreateOpen(true) }}>
                Browse Templates
              </button>
            </div>
          ) : (
            <>
              {/* Today's Focus */}
              {focus && (
                <div>
                  <span style={sectionLabel}>Today's Focus</span>
                  <button
                    onClick={() => navigate(`/list/${focus.id}`)}
                    className="card"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '18px 16px', cursor: 'pointer', textAlign: 'left',
                      borderColor: 'rgba(22,163,74,0.25)',
                    }}
                  >
                    <span style={{ fontSize: 30, flexShrink: 0 }}>{focus.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }} className="truncate">{focus.name}</p>
                      <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 3 }}>
                        {focusPending} {focusPending === 1 ? 'item' : 'items'} remaining
                      </p>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      Continue <ArrowRight size={15} strokeWidth={2.5} />
                    </span>
                  </button>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <span style={sectionLabel}>Quick Actions</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {quickAction('New List', <PlusCircle size={20} />, () => { setCreateStep('custom'); setCreateOpen(true) })}
                  {quickAction('Templates', <LayoutTemplate size={20} />, () => { setCreateStep('templates'); setCreateOpen(true) })}
                  {quickAction('Join List', <UserPlus size={20} />, () => { setJoinMsg(null); setJoinCode(''); setJoinOpen(true) })}
                </div>
              </div>

              {/* Smart Insights — max 2, only when actionable */}
              {(uncategorized > 0 || doneList) && (
                <div>
                  <span style={sectionLabel}>Smart Insights</span>
                  <div className="flex-col gap-2">
                    {uncategorized > 0 && (
                      <button onClick={() => navigate('/insights')} className="card"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', textAlign: 'left' }}>
                        <Tag size={17} color="#f59e0b" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 600 }}>
                            {uncategorized} {uncategorized === 1 ? 'item needs' : 'items need'} a category
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 2 }}>
                            Categorized items unlock better insights
                          </p>
                        </div>
                        <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                      </button>
                    )}
                    {doneList && (
                      <button onClick={() => store.setArchived(doneList.id, true)} className="card"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', textAlign: 'left' }}>
                        <Archive size={17} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 600 }} className="truncate">
                            "{doneList.name}" is complete
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 2 }}>
                            Tap to archive it and tidy up
                          </p>
                        </div>
                        <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {activity.length > 0 && (
                <div>
                  <span style={sectionLabel}>Recent Activity</span>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {activity.map(({ item, list }, i) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/list/${list.id}`)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                          borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {item.completed
                          ? <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                          : <PlusCircle size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Timestamp is the add event; completion state shows via icon */}
                          <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4 }} className="truncate">
                            <strong>{item.added_by_name}</strong> added <strong>{item.title}</strong>
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 1 }}>
                            {list.emoji} {list.name} · {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} initialStep={createStep} />

      {/* Join shared list by invite code */}
      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Join Shared List">
        <div className="sheet-body">
          <p className="text-sm text-muted">
            Paste the invite code or link a friend shared with you.
          </p>
          <input
            className="input"
            placeholder="Invite code"
            value={joinCode}
            autoCapitalize="none"
            onChange={e => setJoinCode(e.target.value.trim().split('/').pop() ?? '')}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {joinMsg && (
            <p className="text-sm" style={{ color: joinMsg.ok ? 'var(--accent)' : '#f87171', fontWeight: 600 }}>
              {joinMsg.text}
            </p>
          )}
          <button className="btn btn-primary btn-full" onClick={handleJoin} disabled={!joinCode.trim() || joining}>
            {joining ? <span className="spinner" /> : 'Join List'}
          </button>
        </div>
      </Sheet>
    </>
  )
}
