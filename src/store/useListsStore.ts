import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { List, ListItem, ListMember } from '../types'
import { generateInviteCode } from '../lib/utils'

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
  removeMember: (listId: string, memberId: string) => Promise<void>
  joinByCode: (code: string) => Promise<{ success: boolean; message: string; list?: List }>
  regenerateInvite: (listId: string) => Promise<string | null>
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

function bumpUpdatedAt(listId: string, get: Get, set: Set) {
  const now = new Date().toISOString()
  const list = get().lists.find(l => l.id === listId)
  const prev = list?.updated_at
  set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: now } : l) })
  if (list?.owner_id !== get().userId) return
  supabase.from('lists').update({ updated_at: now }).eq('id', listId).then(({ error }) => {
    if (error) set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: prev ?? now } : l) })
  })
}

export const useListsStore = create<ListsState>((set, get) => ({
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
    set({ userId, displayName, loading: true, loadError: false })
    try {
      const [ownRes, memberRes] = await Promise.all([
        supabase.from('lists').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
        supabase.from('list_members').select('list_id').eq('user_id', userId).neq('role', 'owner'),
      ])
      if (ownRes.error || memberRes.error) { set({ loading: false, loadError: true }); return }

      let shared: List[] = []
      if ((memberRes.data ?? []).length > 0) {
        const ids = memberRes.data!.map(r => r.list_id)
        const { data, error } = await supabase.from('lists').select('*').in('id', ids).order('updated_at', { ascending: false })
        if (error) { set({ loading: false, loadError: true }); return }
        shared = (data ?? []) as List[]
      }

      const all = [...(ownRes.data ?? []) as List[], ...shared]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      set({ lists: all, loading: false, initialized: true })
    } catch {
      set({ loading: false, loadError: true })
    }
  },

  refreshLists: async () => {
    const { userId } = get()
    if (!userId) return
    set({ loading: true })
    try {
      const [ownRes, memberRes] = await Promise.all([
        supabase.from('lists').select('*').eq('owner_id', userId).order('updated_at', { ascending: false }),
        supabase.from('list_members').select('list_id').eq('user_id', userId).neq('role', 'owner'),
      ])
      if (ownRes.error || memberRes.error) { set({ loading: false, loadError: true }); return }
      let shared: List[] = []
      if ((memberRes.data ?? []).length > 0) {
        const ids = memberRes.data!.map(r => r.list_id)
        const { data, error } = await supabase.from('lists').select('*').in('id', ids)
        if (error) { set({ loading: false, loadError: true }); return }
        shared = (data ?? []) as List[]
      }
      const all = [...(ownRes.data ?? []) as List[], ...shared]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      set({ lists: all, loading: false, initialized: true })
    } catch {
      set({ loading: false, loadError: true })
    }
  },

  createList: async ({ name, type, emoji }) => {
    const { userId, displayName } = get()
    const inviteCode = generateInviteCode()
    const { data, error } = await supabase
      .from('lists')
      .insert({ name, type, emoji, owner_id: userId, invite_code: inviteCode })
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
    set({ lists: get().lists.map(l => l.id === listId ? { ...l, name: trimmed } : l) })
    await supabase.from('lists').update({ name: trimmed }).eq('id', listId)
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
    const inviteCode = generateInviteCode()
    const { data } = await supabase
      .from('lists')
      .insert({ name: `${orig.name} (copy)`, type: orig.type, emoji: orig.emoji, owner_id: userId, invite_code: inviteCode })
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
      .insert({ name: orig.name, type: orig.type, emoji: orig.emoji, owner_id: userId, invite_code: generateInviteCode(), is_template: true })
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
      .insert({ name, type: 'shopping', emoji, owner_id: userId, invite_code: generateInviteCode(), is_template: true })
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
      .insert({ name: tpl.name, type: tpl.type, emoji: tpl.emoji, owner_id: userId, invite_code: generateInviteCode() })
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
    await supabase.from('list_members').delete().eq('list_id', listId).eq('user_id', userId)
    set({
      lists: get().lists.filter(l => l.id !== listId),
      items: Object.fromEntries(Object.entries(get().items).filter(([k]) => k !== listId)),
      members: Object.fromEntries(Object.entries(get().members).filter(([k]) => k !== listId)),
    })
  },

  loadItems: async (listId) => {
    const { data } = await supabase.from('list_items').select('*').eq('list_id', listId).order('created_at')
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
    const { data, error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, title, quantity: quantity || null, category, added_by_name: displayName })
      .select()
      .single()
    if (error || !data) { set({ lastError: "Couldn't add item — try again" }); return }
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
    let { error } = await supabase.from('list_items').update(patch).eq('id', item.id)
    // Migration-v4 not applied yet: retry without the timestamp column
    // (PGRST204 = unknown column) so toggling keeps working.
    if (error?.code === 'PGRST204') {
      ({ error } = await supabase.from('list_items')
        .update({ completed: patch.completed, completed_by_name: patch.completed_by_name })
        .eq('id', item.id))
    }
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  updateItem: async (listId, itemId, patch) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.map(i => i.id === itemId ? { ...i, ...patch } : i) } })
    const { error } = await supabase.from('list_items').update(patch).eq('id', itemId)
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  deleteItem: async (listId, itemId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.filter(i => i.id !== itemId) } })
    const { error } = await supabase.from('list_items').delete().eq('id', itemId)
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't delete — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  uncheckAll: async (listId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: prev.map(i => ({ ...i, completed: false, completed_by_name: null, completed_at: null })) } })
    let { error } = await supabase.from('list_items')
      .update({ completed: false, completed_by_name: null, completed_at: null }).eq('list_id', listId)
    if (error?.code === 'PGRST204') {
      ({ error } = await supabase.from('list_items')
        .update({ completed: false, completed_by_name: null }).eq('list_id', listId))
    }
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  removeMember: async (listId, memberId) => {
    const prev = get().members[listId] ?? []
    set({ members: { ...get().members, [listId]: prev.filter(m => m.id !== memberId) } })
    const { error } = await supabase.rpc('remove_list_member', { p_list_id: listId, p_member_id: memberId })
    if (error) set({ members: { ...get().members, [listId]: prev }, lastError: "Couldn't remove member" })
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

  regenerateInvite: async (listId) => {
    const code = generateInviteCode()
    const { error } = await supabase.from('lists').update({ invite_code: code }).eq('id', listId)
    if (error) return null
    set({ lists: get().lists.map(l => l.id === listId ? { ...l, invite_code: code } : l) })
    return code
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
}))
