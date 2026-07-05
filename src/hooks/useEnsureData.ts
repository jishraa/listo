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
    // Prefer the resolved display name (guests keep the name they entered on
    // the join screen) over the "User" fallback so a direct-load re-init never
    // clobbers a guest's identity — otherwise their items show as "User".
    const name = displayName || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
    store.init(user.id, name)
    useCategoriesStore.getState().init(user.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const listIdsKey = store.lists.map(l => l.id).join(',')
  useEffect(() => {
    for (const list of store.lists) {
      if (!store.items[list.id]) store.loadItems(list.id)
      if (!store.members[list.id]) store.loadMembers(list.id)
    }
  // Keyed on the id set (not the count) so a swap still triggers a reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIdsKey])
}
