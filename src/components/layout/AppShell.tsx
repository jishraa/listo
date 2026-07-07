import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ListChecks, Plus, User } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useListsStore } from '../../store/useListsStore'
import { useCategoriesStore } from '../../store/useCategoriesStore'
import { useMemoryStore } from '../../store/useMemoryStore'
import CreateListSheet from '../lists/CreateListSheet'
import type { ListType } from '../../types'

const TABS = [
  { path: '/',        label: 'Lists',   Icon: ListChecks },
  { path: '/profile', label: 'Profile', Icon: User },
]

// App shell for the four tab pages: owns the bottom nav, the center-FAB
// Create List sheet, and the lists-store init so every tab (not just Lists)
// has data on direct navigation. Drill-in pages (ListDetail, Join) render
// outside the shell with their own full-screen layout.
export default function AppShell() {
  const { user, displayName, isGuest } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    // Prefer the resolved display name (guests: their chosen name from the
    // join screen; members: their profile name) so a re-init never overwrites
    // a guest's identity with the "User" fallback.
    const name = displayName || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
    store.init(user.id, name)
    useCategoriesStore.getState().init(user.id)
    useMemoryStore.getState().load(user.id)
  }, [user])

  // Items/members power every tab (Home stats, Insights, Lists progress),
  // so load them here rather than in any one page. The first pass on mount
  // refetches everything (the persisted offline cache pre-fills entries and
  // this keeps them fresh; no-ops harmlessly offline). After that, id-set
  // changes only fetch the ADDED lists — creating/joining list N must not
  // re-issue 2×N queries for the ones already loaded.
  const fetchedIds = useRef(new Set<string>())
  const listIdsKey = store.lists.map(l => l.id).join(',')
  useEffect(() => {
    for (const list of store.lists) {
      if (fetchedIds.current.has(list.id)) continue
      fetchedIds.current.add(list.id)
      store.loadItems(list.id)
      store.loadMembers(list.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIdsKey])

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    // Guests can't own lists — creation would orphan the data when their
    // anonymous session ends. The FAB is hidden for them; this is a backstop.
    if (isGuest) return
    await store.createList({ name, type, emoji, items: templateItems })
  }

  return (
    // Tab pages have no .header, so the shell applies the status-bar
    // safe-area inset (drill-in pages handle it via .header's --safe-top).
    <div className="app-container" style={{ paddingTop: 'var(--safe-top)' }}>
      <Outlet />

      <nav className="bottom-nav">
        {TABS.slice(0, 1).map(({ path, label, Icon }) => (
          <button key={path} className={`nav-item ${pathname === path ? 'active' : ''}`} onClick={() => navigate(path)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
        {/* Guests can't create lists — keep the slot for layout, hide the FAB */}
        {isGuest ? (
          <div style={{ width: 52, flexShrink: 0 }} aria-hidden />
        ) : (
          <button
            onClick={() => setCreateOpen(true)}
            aria-label="Create list"
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              marginTop: -14,
              boxShadow: '0 0 20px rgba(22,163,74,0.45)',
            }}
          >
            <Plus size={24} color="#04080f" strokeWidth={2.5} />
          </button>
        )}
        {TABS.slice(1).map(({ path, label, Icon }) => (
          <button key={path} className={`nav-item ${pathname === path ? 'active' : ''}`} onClick={() => navigate(path)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
    </div>
  )
}
