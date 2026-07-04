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
  const { user, displayName } = useAuthStore()
  const store = useListsStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const name = (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
    store.init(user.id, name || displayName)
    useCategoriesStore.getState().init(user.id)
  }, [user])

  // Items/members power every tab (Home stats, Insights, Lists progress),
  // so load them here rather than in any one page.
  useEffect(() => {
    for (const list of store.lists) {
      if (!store.items[list.id]) store.loadItems(list.id)
      if (!store.members[list.id]) store.loadMembers(list.id)
    }
  }, [store.lists.length])

  const handleCreate = async (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => {
    const list = await store.createList({ name, type, emoji })
    if (!list) return
    if (templateItems?.length) {
      for (const item of templateItems) {
        await store.addItem(list.id, item.title, '', item.category ?? null)
      }
    }
  }

  return (
    <div className="app-container">
      <Outlet />

      <nav className="bottom-nav">
        {TABS.slice(0, 1).map(({ path, label, Icon }) => (
          <button key={path} className={`nav-item ${pathname === path ? 'active' : ''}`} onClick={() => navigate(path)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
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
