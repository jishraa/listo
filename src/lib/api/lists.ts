import { supabase } from '../supabase'
import type { List } from '../../types'

// Repository layer: ALL Supabase IO for `lists` lives here. Stores own state,
// optimistic updates and the offline queue — never raw queries.

/** Owned + shared lists, merged and sorted most-recent-first. Null on error. */
export async function fetchAllLists(userId: string): Promise<List[] | null> {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('lists').select('*').eq('owner_id', userId),
    supabase.from('list_members').select('list_id').eq('user_id', userId).neq('role', 'owner'),
  ])
  if (ownRes.error || memberRes.error) return null

  let shared: List[] = []
  const memberIds = (memberRes.data ?? []).map(r => r.list_id)
  if (memberIds.length > 0) {
    const { data, error } = await supabase.from('lists').select('*').in('id', memberIds)
    if (error) return null
    shared = (data ?? []) as List[]
  }
  return [...(ownRes.data ?? []) as List[], ...shared]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export async function insertList(row: {
  name: string; type: List['type']; emoji: string; owner_id: string; is_template?: boolean
}): Promise<List | null> {
  const { data, error } = await supabase.from('lists').insert(row).select().single()
  return error || !data ? null : (data as List)
}

export async function insertOwnerMembership(listId: string, userId: string, displayName: string): Promise<void> {
  await supabase.from('list_members').insert({
    list_id: listId, user_id: userId, role: 'owner', display_name: displayName,
  })
}

/** Rename / archive / restore. True on success. */
export async function updateList(listId: string, patch: Partial<Pick<List, 'name' | 'archived_at'>>): Promise<boolean> {
  const { error } = await supabase.from('lists').update(patch).eq('id', listId)
  return !error
}

export async function deleteList(listId: string): Promise<boolean> {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  return !error
}

/** Bump updated_at via RPC — members (not just owners) may touch (v13). */
export async function touchList(listId: string): Promise<boolean> {
  const { error } = await supabase.rpc('touch_list', { p_list_id: listId })
  return !error
}

/** Copy items to a new list (fresh, uncompleted), attributed to displayName. */
export async function copyItems(
  fromItems: { title: string; quantity: string | null; category: string | null; sort_order: number }[],
  toListId: string,
  displayName: string,
): Promise<void> {
  if (fromItems.length === 0) return
  await Promise.all(fromItems.map(item =>
    supabase.from('list_items').insert({
      list_id: toListId, title: item.title, quantity: item.quantity,
      category: item.category, sort_order: item.sort_order, added_by_name: displayName,
    })
  ))
}
