import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { List, ListItem, ListMember, InvitePreview } from '../types'
// Deferred circular import (sync store also imports this one) — both only
// touch each other inside functions, never at module top level.
import { useSyncStore, newOpId, newTempId, isTempId, isNetworkError } from './useSyncStore'
import { useMemoryStore } from './useMemoryStore'

interface ListsState {
  lists: List[]
  items: Record<string, ListItem[]>
  members: Record<string, ListMember[]>
  loading: boolean
  initialized: boolean
  userId: string
  displayName: string
  loadError: boolean
  lastError: string | null
  clearError: () => void

  init: (userId: string, displayName: string) => Promise<void>
  refreshLists: () => Promise<void>
  createList: (params: { name: string; type: List['type']; emoji: string }) => Promise<List | null>
  renameList: (listId: string, name: string) => Promise<void>
  deleteList: (listId: string) => Promise<void>
  duplicateList: (listId: string) => Promise<void>
  saveAsTemplate: (listId: string) => Promise<void>
  createTemplate: (name: string, emoji: string, items: { title: string; category: string | null }[]) => Promise<void>
  createFromTemplate: (templateId: string) => Promise<List | null>
  setArchived: (listId: string, archived: boolean) => Promise<void>
  leaveList: (listId: string) => Promise<void>
  loadItems: (listId: string) => Promise<void>
  loadMembers: (listId: string) => Promise<void>
  addItem: (listId: string, title: string, quantity: string, category: string | null) => Promise<void>
  toggleItem: (listId: string, item: ListItem) => Promise<void>
  updateItem: (listId: string, itemId: string, patch: { title?: string; quantity?: string | null; category?: string | null }) => Promise<void>
  deleteItem: (listId: string, itemId: string) => Promise<void>
  uncheckAll: (listId: string) => Promise<void>
  /** Remove every item from a list (used to start a fresh next trip). Online-only. */
  clearItems: (listId: string) => Promise<void>
  removeMember: (listId: string, memberId: string) => Promise<void>
  setMemberRole: (listId: string, memberId: string, role: 'collaborator' | 'viewer') => Promise<void>
  joinByCode: (code: string) => Promise<{ success: boolean; message: string; list?: List }>
  /** Mint a fresh invite link at the given access level; returns the new code. */
  regenerateInvite: (listId: string, role?: 'collaborator' | 'viewer') => Promise<string | null>
  /** Owner-only: the list's current invite code + level, or null if none/not owner. */
  getInvite: (listId: string) => Promise<{ code: string; role: 'collaborator' | 'viewer' } | null>
  /** Resolve a code to a list id, but only for someone already in that list. */
  resolveListIdByCode: (code: string) => Promise<string | null>
  /** Non-sensitive preview of a shared link, for the pre-auth join screen. */
  getInvitePreview: (code: string) => Promise<InvitePreview | null>
  /** The signed-in user's role on a list, or null if not a member. */
  myRole: (listId: string) => ListMember['role'] | null
  subscribeToList: (listId: string) => () => void
}

type Get = () => ListsState
type Set = (partial: Partial<ListsState>) => void

// Central list filters — every surface (Home stats, Insights, Lists sections)
// must exclude templates and archived lists from "normal" views through these.
// `!!` because rows loaded before migration v3 lack the columns entirely.
export const visibleLists  = (lists: List[]) => lists.filter(l => !l.is_template && !l.archived_at)
export const templateLists = (lists: List[]) => lists.filter(l => !!l.is_template)
export const archivedLists = (lists: List[]) => lists.filter(l => !l.is_template && !!l.archived_at)

// Copies a list's items to a new list (fresh, uncompleted).
async function copyItems(fromItems: { title: string; quantity: string | null; category: string | null; sort_order: number }[], toListId: string, displayName: string) {
  if (fromItems.length === 0) return
  await Promise.all(fromItems.map(item =>
    supabase.from('list_items').insert({
      list_id: toListId, title: item.title, quantity: item.quantity,
      category: item.category, sort_order: item.sort_order, added_by_name: displayName,
    })
  ))
}

// Fetch a user's owned + shared lists, merged and sorted most-recent-first.
// Returns null on any query error so callers can decide how to surface it.
async function fetchAllLists(userId: string): Promise<List[] | null> {
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

function bumpUpdatedAt(listId: string, get: Get, set: Set) {
  const now = new Date().toISOString()
  const list = get().lists.find(l => l.id === listId)
  const prev = list?.updated_at
  set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: now } : l) })
  // Via RPC so collaborators (who can't UPDATE lists directly since v9) still
  // re-sort a shared list when they change items. touch_list only bumps the
  // timestamp and only for members.
  supabase.rpc('touch_list', { p_list_id: listId }).then(({ error }) => {
    if (error) set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: prev ?? now } : l) })
  })
}

export const useListsStore = create<ListsState>()(persist((set, get) => ({
  lists: [],
  items: {},
  members: {},
  loading: false,
  initialized: false,
  userId: '',
  displayName: '',
  loadError: false,
  lastError: null,
  clearError: () => set({ lastError: null }),

  init: async (userId, displayName) => {
    if (get().userId === userId && get().initialized && !get().loading) {
      set({ displayName })
      return
    }
    // Cache hydrated from a different account must never leak across users.
    if (get().userId && get().userId !== userId) {
      set({ lists: [], items: {}, members: {}, initialized: false })
    }
    // Offline-first: hydrated data (same user) renders immediately; the
    // network pass below refreshes it when reachable.
    const hasCache = get().userId === userId && get().lists.length > 0
    set({ userId, displayName, loading: !hasCache, loadError: false, ...(hasCache ? { initialized: true } : {}) })
    try {
      const all = await fetchAllLists(userId)
      if (all === null) { set({ loading: false, loadError: !hasCache }); return }
      set({ lists: all, loading: false, initialized: true })
    } catch {
      // Network unreachable — cached data (if any) keeps the app usable.
      set({ loading: false, loadError: !hasCache })
    }
  },

  refreshLists: async () => {
    const { userId } = get()
    if (!userId) return
    set({ loading: true })
    try {
      const all = await fetchAllLists(userId)
      if (all === null) { set({ loading: false, loadError: true }); return }
      set({ lists: all, loading: false, initialized: true })
    } catch {
      set({ loading: false, loadError: true })
    }
  },

  createList: async ({ name, type, emoji }) => {
    const { userId, displayName } = get()
    const { data, error } = await supabase
      .from('lists')
      .insert({ name, type, emoji, owner_id: userId })
      .select()
      .single()
    if (error || !data) { set({ lastError: "Couldn't create list — try again" }); return null }
    const list = data as List
    await supabase.from('list_members').insert({
      list_id: list.id, user_id: userId, role: 'owner', display_name: displayName,
    })
    set({ lists: [list, ...get().lists] })
    return list
  },

  renameList: async (listId, name) => {
    const trimmed = name.trim().slice(0, 100)
    if (!trimmed) return
    const prev = get().lists
    set({ lists: prev.map(l => l.id === listId ? { ...l, name: trimmed } : l) })
    const { error } = await supabase.from('lists').update({ name: trimmed }).eq('id', listId)
    if (error) set({ lists: prev, lastError: "Couldn't rename — try again" })
  },

  deleteList: async (listId) => {
    const { error } = await supabase.from('lists').delete().eq('id', listId)
    if (error) { set({ lastError: "Couldn't delete list — try again" }); return }
    set({
      lists: get().lists.filter(l => l.id !== listId),
      items: Object.fromEntries(Object.entries(get().items).filter(([k]) => k !== listId)),
      members: Object.fromEntries(Object.entries(get().members).filter(([k]) => k !== listId)),
    })
  },

  duplicateList: async (listId) => {
    const { userId, displayName } = get()
    const orig = get().lists.find(l => l.id === listId)
    if (!orig) return
    const { data } = await supabase
      .from('lists')
      .insert({ name: `${orig.name} (copy)`, type: orig.type, emoji: orig.emoji, owner_id: userId })
      .select()
      .single()
    if (!data) return
    const newList = data as List
    await supabase.from('list_members').insert({ list_id: newList.id, user_id: userId, role: 'owner', display_name: displayName })
    await copyItems(get().items[listId] ?? [], newList.id, displayName)
    set({ lists: [newList, ...get().lists] })
  },

  saveAsTemplate: async (listId) => {
    const { userId, displayName } = get()
    const orig = get().lists.find(l => l.id === listId)
    if (!orig) return
    const { data, error } = await supabase
      .from('lists')
      .insert({ name: orig.name, type: orig.type, emoji: orig.emoji, owner_id: userId, is_template: true })
      .select()
      .single()
    if (error || !data) { set({ lastError: "Couldn't save template — try again" }); return }
    const tpl = data as List
    await supabase.from('list_members').insert({ list_id: tpl.id, user_id: userId, role: 'owner', display_name: displayName })
    await copyItems(get().items[listId] ?? [], tpl.id, displayName)
    set({ lists: [tpl, ...get().lists] })
  },

  // Template from arbitrary items (e.g. Insights "Suggested for You").
  createTemplate: async (name, emoji, tplItems) => {
    const { userId, displayName } = get()
    const { data, error } = await supabase
      .from('lists')
      .insert({ name, type: 'shopping', emoji, owner_id: userId, is_template: true })
      .select()
      .single()
    if (error || !data) { set({ lastError: "Couldn't save template — try again" }); return }
    const tpl = data as List
    await supabase.from('list_members').insert({ list_id: tpl.id, user_id: userId, role: 'owner', display_name: displayName })
    await copyItems(tplItems.map((t, i) => ({ title: t.title, quantity: null, category: t.category, sort_order: i })), tpl.id, displayName)
    set({ lists: [tpl, ...get().lists] })
  },

  createFromTemplate: async (templateId) => {
    const { userId, displayName } = get()
    const tpl = get().lists.find(l => l.id === templateId)
    if (!tpl) return null
    const { data, error } = await supabase
      .from('lists')
      .insert({ name: tpl.name, type: tpl.type, emoji: tpl.emoji, owner_id: userId })
      .select()
      .single()
    if (error || !data) { set({ lastError: "Couldn't create list — try again" }); return null }
    const list = data as List
    await supabase.from('list_members').insert({ list_id: list.id, user_id: userId, role: 'owner', display_name: displayName })
    if (!get().items[templateId]) await get().loadItems(templateId)
    await copyItems(get().items[templateId] ?? [], list.id, displayName)
    set({ lists: [list, ...get().lists] })
    return list
  },

  setArchived: async (listId, archived) => {
    const prev = get().lists
    const archived_at = archived ? new Date().toISOString() : null
    set({ lists: prev.map(l => l.id === listId ? { ...l, archived_at } : l) })
    const { error } = await supabase.from('lists').update({ archived_at }).eq('id', listId)
    if (error) set({ lists: prev, lastError: archived ? "Couldn't archive — try again" : "Couldn't restore — try again" })
  },

  leaveList: async (listId) => {
    const { userId } = get()
    // Requires the "members can leave" delete policy (migration v9);
    // .select() makes RLS silently deleting 0 rows detectable.
    const { data, error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId)
      .select('id')
    if (error || (data ?? []).length === 0) {
      set({ lastError: "Couldn't leave the list — try again" })
      return
    }
    set({
      lists: get().lists.filter(l => l.id !== listId),
      items: Object.fromEntries(Object.entries(get().items).filter(([k]) => k !== listId)),
      members: Object.fromEntries(Object.entries(get().members).filter(([k]) => k !== listId)),
    })
  },

  loadItems: async (listId) => {
    const { data, error } = await supabase.from('list_items').select('*').eq('list_id', listId).order('created_at')
    // Offline / transient failure: keep the cached items rather than wiping.
    if (error) return
    set({ items: { ...get().items, [listId]: (data ?? []) as ListItem[] } })
  },

  loadMembers: async (listId) => {
    const { data, error } = await supabase.from('list_members').select('*').eq('list_id', listId)
    // Don't overwrite existing members with [] on error (e.g. transient RLS
    // failure) — keep whatever we last had so shared indicators don't blink out.
    if (error) { if (import.meta.env.DEV) console.warn('loadMembers failed', listId, error.message); return }
    set({ members: { ...get().members, [listId]: (data ?? []) as ListMember[] } })
  },

  addItem: async (listId, title, quantity, category) => {
    const { displayName } = get()
    // List Memory: every add teaches the user's history (fire-and-forget, best
    // effort — never blocks or fails the add).
    useMemoryStore.getState().record(title, category, quantity || null)
    // Offline (or the request dies mid-air): apply a temp row locally and
    // queue the insert — the sync engine swaps in the server row later.
    const addOffline = () => {
      const tempId = newTempId()
      const temp: ListItem = {
        id: tempId, list_id: listId, title, quantity: quantity || null, completed: false,
        added_by_name: displayName, completed_by_name: null, completed_at: null,
        category, sort_order: 0, created_at: new Date().toISOString(),
      }
      set({ items: { ...get().items, [listId]: [...(get().items[listId] ?? []), temp] } })
      useSyncStore.getState().enqueue({
        kind: 'add', opId: newOpId(), listId, tempId,
        title, quantity: quantity || null, category, addedByName: displayName,
      })
    }
    if (!useSyncStore.getState().online) { addOffline(); return }
    const { data, error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, title, quantity: quantity || null, category, added_by_name: displayName })
      .select()
      .single()
    if (error || !data) {
      if (isNetworkError(error?.message)) { addOffline(); return }
      set({ lastError: "Couldn't add item — try again" })
      return
    }
    const current = get().items[listId] ?? []
    if (!current.find(i => i.id === (data as ListItem).id))
      set({ items: { ...get().items, [listId]: [...current, data as ListItem] } })
    bumpUpdatedAt(listId, get, set)
  },

  toggleItem: async (listId, item) => {
    const { displayName } = get()
    const next = !item.completed
    const patch = {
      completed: next,
      completed_by_name: next ? displayName : null,
      completed_at: next ? new Date().toISOString() : null,
    }
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.map(i => i.id === item.id ? { ...i, ...patch } : i) } })
    if (!useSyncStore.getState().online) {
      useSyncStore.getState().enqueue({ kind: 'update', opId: newOpId(), listId, itemId: item.id, patch })
      return
    }
    let { error } = await supabase.from('list_items').update(patch).eq('id', item.id)
    // Migration-v4 not applied yet: retry without the timestamp column
    // (PGRST204 = unknown column) so toggling keeps working.
    if (error?.code === 'PGRST204') {
      ({ error } = await supabase.from('list_items')
        .update({ completed: patch.completed, completed_by_name: patch.completed_by_name })
        .eq('id', item.id))
    }
    if (error) {
      if (isNetworkError(error.message)) {
        useSyncStore.getState().enqueue({ kind: 'update', opId: newOpId(), listId, itemId: item.id, patch })
        return
      }
      set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    }
    else bumpUpdatedAt(listId, get, set)
  },

  updateItem: async (listId, itemId, patch) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.map(i => i.id === itemId ? { ...i, ...patch } : i) } })
    if (!useSyncStore.getState().online) {
      useSyncStore.getState().enqueue({ kind: 'update', opId: newOpId(), listId, itemId, patch })
      return
    }
    const { error } = await supabase.from('list_items').update(patch).eq('id', itemId)
    if (error) {
      if (isNetworkError(error.message)) {
        useSyncStore.getState().enqueue({ kind: 'update', opId: newOpId(), listId, itemId, patch })
        return
      }
      set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    }
    else bumpUpdatedAt(listId, get, set)
  },

  deleteItem: async (listId, itemId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.filter(i => i.id !== itemId) } })
    // A temp item never reached the server — just cancel its queued ops.
    if (isTempId(itemId)) { useSyncStore.getState().dropForItem(itemId); return }
    if (!useSyncStore.getState().online) {
      useSyncStore.getState().enqueue({ kind: 'delete', opId: newOpId(), listId, itemId })
      return
    }
    const { error } = await supabase.from('list_items').delete().eq('id', itemId)
    if (error) {
      if (isNetworkError(error.message)) {
        useSyncStore.getState().enqueue({ kind: 'delete', opId: newOpId(), listId, itemId })
        return
      }
      set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't delete — try again" })
    }
    else bumpUpdatedAt(listId, get, set)
  },

  uncheckAll: async (listId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.map(i => ({ ...i, completed: false, completed_by_name: null, completed_at: null })) } })
    if (!useSyncStore.getState().online) {
      // One queued update per completed item — replayed on reconnect.
      const sync = useSyncStore.getState()
      const patch = { completed: false, completed_by_name: null, completed_at: null }
      prev.filter(i => i.completed).forEach(i =>
        sync.enqueue({ kind: 'update', opId: newOpId(), listId, itemId: i.id, patch }))
      return
    }
    let { error } = await supabase.from('list_items')
      .update({ completed: false, completed_by_name: null, completed_at: null }).eq('list_id', listId)
    if (error?.code === 'PGRST204') {
      ({ error } = await supabase.from('list_items')
        .update({ completed: false, completed_by_name: null }).eq('list_id', listId))
    }
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  clearItems: async (listId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: [] } })
    const { error } = await supabase.from('list_items').delete().eq('list_id', listId)
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't clear items — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  removeMember: async (listId, memberId) => {
    const prev = get().members[listId] ?? []
    set({ members: { ...get().members, [listId]: prev.filter(m => m.id !== memberId) } })
    const { error } = await supabase.rpc('remove_list_member', { p_list_id: listId, p_member_id: memberId })
    if (error) set({ members: { ...get().members, [listId]: prev }, lastError: "Couldn't remove member" })
  },

  setMemberRole: async (listId, memberId, role) => {
    const prev = get().members[listId] ?? []
    set({ members: { ...get().members, [listId]: prev.map(m => m.id === memberId ? { ...m, role } : m) } })
    const { error } = await supabase.rpc('set_member_role', { p_member_id: memberId, p_role: role })
    if (error) set({ members: { ...get().members, [listId]: prev }, lastError: "Couldn't change access" })
  },

  myRole: (listId) => {
    const { userId } = get()
    const list = get().lists.find(l => l.id === listId)
    if (list && list.owner_id === userId) return 'owner'
    return get().members[listId]?.find(m => m.user_id === userId)?.role ?? null
  },

  joinByCode: async (code) => {
    const { displayName } = get()
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!/^[a-z0-9]{6,12}$/.test(clean)) return { success: false, message: 'Invalid invite code' }
    const { data, error } = await supabase.rpc('redeem_list_invite', { p_code: clean, p_display_name: displayName })
    if (error) {
      if (error.message?.includes('own_list'))       return { success: false, message: 'You already own this list' }
      if (error.message?.includes('already_member')) return { success: false, message: 'Already joined' }
      if (error.message?.includes('expired_code'))   return { success: false, message: 'This invite link has expired' }
      return { success: false, message: 'Invalid invite code' }
    }
    const list = (Array.isArray(data) ? data[0] : data) as List | null
    if (!list) return { success: false, message: 'Invalid invite code' }
    if (get().lists.some(l => l.id === list.id)) return { success: true, message: `Already joined "${list.name}"`, list }
    set({ lists: [list, ...get().lists] })
    return { success: true, message: `Joined "${list.name}"`, list }
  },

  regenerateInvite: async (listId, role = 'collaborator') => {
    // The invite secret lives on the owner-only list_invites table; minting is
    // done by a SECURITY DEFINER RPC that verifies ownership and returns the code.
    const { data, error } = await supabase.rpc('rotate_invite', { p_list_id: listId, p_role: role })
    if (error || !data) return null
    return data as string
  },

  getInvite: async (listId) => {
    const { data, error } = await supabase
      .from('list_invites').select('code, role').eq('list_id', listId).maybeSingle()
    if (error || !data) return null
    return { code: data.code as string, role: data.role as 'collaborator' | 'viewer' }
  },

  resolveListIdByCode: async (code) => {
    const { data, error } = await supabase.rpc('member_list_id_for_code', { p_code: code })
    if (error) return null
    return (data as string | null) ?? null
  },

  getInvitePreview: async (code) => {
    const { data, error } = await supabase.rpc('invite_preview', { p_code: code })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row) return null
    return {
      listId: row.list_id, name: row.name, emoji: row.emoji, type: row.type,
      ownerName: row.owner_name, memberCount: row.member_count,
    } as InvitePreview
  },

  subscribeToList: (listId) => {
    let hasSubscribed = false
    const channel = supabase
      .channel(`list_items_${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` }, payload => {
        const current = get().items[listId] ?? []
        if (payload.eventType === 'INSERT') {
          if (!current.find(i => i.id === (payload.new as ListItem).id))
            set({ items: { ...get().items, [listId]: [...current, payload.new as ListItem] } })
        } else if (payload.eventType === 'UPDATE') {
          set({ items: { ...get().items, [listId]: current.map(i => i.id === (payload.new as ListItem).id ? payload.new as ListItem : i) } })
        } else if (payload.eventType === 'DELETE') {
          set({ items: { ...get().items, [listId]: current.filter(i => i.id !== (payload.old as ListItem).id) } })
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribed) { get().loadItems(listId); get().loadMembers(listId) }
          hasSubscribed = true
        }
      })
    return () => { supabase.removeChannel(channel) }
  },
}), {
  // Offline-first cache: lists/items/members render instantly on cold start
  // and stay readable with no network. Only data is persisted — transient
  // flags and functions are rebuilt each session.
  name: 'listo-lists-cache',
  partialize: (s) => ({
    lists: s.lists, items: s.items, members: s.members,
    userId: s.userId, displayName: s.displayName,
  }),
}))
