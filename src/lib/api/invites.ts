import { supabase } from '../supabase'
import type { List, InvitePreview } from '../../types'

// Repository layer for the invite system. The secret lives on the owner-only
// list_invites table (v11); everything here goes through RPCs or owner reads.

/** Redeem a code. Returns the joined list, or the raw error message
 *  (invalid_code / expired_code / own_list / already_member) for mapping. */
export async function redeemInvite(code: string, displayName: string): Promise<{ list: List | null; errorMessage: string | null }> {
  const { data, error } = await supabase.rpc('redeem_list_invite', { p_code: code, p_display_name: displayName })
  if (error) return { list: null, errorMessage: error.message ?? 'invalid_code' }
  const list = (Array.isArray(data) ? data[0] : data) as List | null
  return { list, errorMessage: null }
}

/** Mint/rotate the invite at an access level; returns the fresh code. */
export async function rotateInvite(listId: string, role: 'collaborator' | 'viewer'): Promise<string | null> {
  const { data, error } = await supabase.rpc('rotate_invite', { p_list_id: listId, p_role: role })
  return error || !data ? null : (data as string)
}

/** Owner-only: the current invite code + level, or null. */
export async function getInvite(listId: string): Promise<{ code: string; role: 'collaborator' | 'viewer' } | null> {
  const { data, error } = await supabase
    .from('list_invites').select('code, role').eq('list_id', listId).maybeSingle()
  if (error || !data) return null
  return { code: data.code as string, role: data.role as 'collaborator' | 'viewer' }
}

/** Resolve a code → list id, only for someone already in that list. */
export async function resolveListIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('member_list_id_for_code', { p_code: code })
  return error ? null : ((data as string | null) ?? null)
}

/** Non-sensitive preview for the pre-auth join screen. */
export async function fetchInvitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('invite_preview', { p_code: code })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return null
  return {
    listId: row.list_id, name: row.name, emoji: row.emoji, type: row.type,
    ownerName: row.owner_name, memberCount: row.member_count,
  } as InvitePreview
}
