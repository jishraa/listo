import { useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import { useCategoriesStore } from '../store/useCategoriesStore'

// Drill-in pages (ListDetail, profile sub-pages) render outside AppShell,
// so a direct load / refresh needs the same store bootstrap the shell does.
export function useEnsureData() {
  const { user, displayName } = useAuthStore()
  const store = useListsStore()

  useEffect(() => {
    if (!user) return
    const name = (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
    store.init(user.id, name || displayName)
    useCategoriesStore.getState().init(user.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    for (const list of store.lists) {
      if (!store.items[list.id]) store.loadItems(list.id)
      if (!store.members[list.id]) store.loadMembers(list.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.lists.length])
}
