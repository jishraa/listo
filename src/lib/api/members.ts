import { supabase } from '../supabase'
import type { ListMember } from '../../types'

// Repository layer for `list_members`. Role changes and removals go through
// SECURITY DEFINER RPCs — RLS has no UPDATE policy on this table (v10).

export async function fetchMembers(listId: string): Promise<ListMember[] | null> {
  const { data, error } = await supabase.from('list_members').select('*').eq('list_id', listId)
  if (error) {
    if (import.meta.env.DEV) console.warn('fetchMembers failed', listId, error.message)
    return null
  }
  return (data ?? []) as ListMember[]
}

export async function removeMember(listId: string, memberId: string): Promise<boolean> {
  const { error } = await supabase.rpc('remove_list_member', { p_list_id: listId, p_member_id: memberId })
  return !error
}

export async function setMemberRole(memberId: string, role: 'collaborator' | 'viewer'): Promise<boolean> {
  const { error } = await supabase.rpc('set_member_role', { p_member_id: memberId, p_role: role })
  return !error
}

/** Leave a list. `.select()` makes RLS silently deleting 0 rows detectable. */
export async function leaveList(listId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('list_members').delete().eq('list_id', listId).eq('user_id', userId).select('id')
  return !error && (data ?? []).length > 0
}
