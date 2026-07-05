import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ListChecks, Plus, User } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useListsStore } from '../../store/useListsStore'
import { useCategoriesStore } from '../../store/useCategoriesStore'
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
  }, [user])

  // Items/members power every tab (Home stats, Insights, Lists progress),
  // so load them here rather than in any one page. Always refetch — the
  // persisted offline cache pre-fills entries, and these calls keep them
  // fresh (they no-op harmlessly when offline). Keyed on the id set (not the
  // count) so a swap that keeps the length still triggers a reload.
  const listIdsKey = store.lists.map(l => l.id).join(',')
  useEffect(() => {
    for (const list of store.lists) {
      store.loadItems(list.id)
      store.loadMembers(list.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIdsKey])

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    // Guests can't own lists — creation would orphan the data when their
    // anonymous session ends. The FAB is hidden for them; this is a backstop.
    if (isGuest) return
    const list = await store.createList({ name, type, emoji })
    if (!list) return
    if (templateItems?.length) {
      for (const item of templateItems) {
        await store.addItem(list.id, item.title, '', item.category ?? null)
      }
    }
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
