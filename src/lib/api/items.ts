import { supabase } from '../supabase'
import type { ListItem } from '../../types'
import type { ItemPatch } from '../../store/useSyncStore'

// Repository layer for `list_items`. Error objects pass through so callers
// can distinguish connectivity failures (queue + retry) from rejections.

export type ApiError = { message?: string; code?: string } | null

export async function fetchItems(listId: string): Promise<ListItem[] | null> {
  const { data, error } = await supabase
    .from('list_items').select('*').eq('list_id', listId).order('created_at')
  return error ? null : ((data ?? []) as ListItem[])
}

export async function insertItem(row: {
  list_id: string; title: string; quantity: string | null; category: string | null; added_by_name: string
}): Promise<{ data: ListItem | null; error: ApiError }> {
  const { data, error } = await supabase.from('list_items').insert(row).select().single()
  return { data: (data as ListItem | null) ?? null, error }
}

/** Patch an item. PGRST204 (= completed_at column missing, migration v4 not
 *  applied) retries without the timestamp so toggling keeps working. */
export async function updateItem(itemId: string, patch: ItemPatch): Promise<{ error: ApiError }> {
  let { error } = await supabase.from('list_items').update(patch).eq('id', itemId)
  if (error?.code === 'PGRST204' && 'completed_at' in patch) {
    const { completed_at: _dropped, ...rest } = patch
    ;({ error } = await supabase.from('list_items').update(rest).eq('id', itemId))
  }
  return { error }
}

export async function deleteItemById(itemId: string): Promise<{ error: ApiError }> {
  const { error } = await supabase.from('list_items').delete().eq('id', itemId)
  return { error }
}

export async function uncheckAllItems(listId: string): Promise<{ error: ApiError }> {
  let { error } = await supabase.from('list_items')
    .update({ completed: false, completed_by_name: null, completed_at: null }).eq('list_id', listId)
  if (error?.code === 'PGRST204') {
    ;({ error } = await supabase.from('list_items')
      .update({ completed: false, completed_by_name: null }).eq('list_id', listId))
  }
  return { error }
}

export async function deleteCompletedItems(listId: string): Promise<{ error: ApiError }> {
  const { error } = await supabase.from('list_items')
    .delete().eq('list_id', listId).eq('completed', true)
  return { error }
}

export async function deleteAllItems(listId: string): Promise<{ error: ApiError }> {
  const { error } = await supabase.from('list_items').delete().eq('list_id', listId)
  return { error }
}

/** Realtime feed for one list's items. Returns the unsubscribe function.
 *  onResubscribe fires on channel recovery (data may have been missed). */
export function subscribeToItems(
  listId: string,
  handlers: {
    onInsert: (item: ListItem) => void
    onUpdate: (item: ListItem) => void
    onDelete: (id: string) => void
    onResubscribe: () => void
  },
): () => void {
  let hasSubscribed = false
  const channel = supabase
    .channel(`list_items_${listId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` }, payload => {
      if (payload.eventType === 'INSERT') handlers.onInsert(payload.new as ListItem)
      else if (payload.eventType === 'UPDATE') handlers.onUpdate(payload.new as ListItem)
      else if (payload.eventType === 'DELETE') handlers.onDelete((payload.old as ListItem).id)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        if (hasSubscribed) handlers.onResubscribe()
        hasSubscribed = true
      }
    })
  return () => { supabase.removeChannel(channel) }
}
