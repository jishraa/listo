import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKeys } from '../lib/storage'
import * as listsApi from '../lib/api/lists'
import * as itemsApi from '../lib/api/items'
import * as membersApi from '../lib/api/members'
import * as invitesApi from '../lib/api/invites'
import type { List, ListItem, ListMember, InvitePreview } from '../types'
// Deferred circular import (sync store also imports this one) — both only
// touch each other inside functions, never at module top level.
import { useSyncStore, newOpId, newTempId, isTempId, isNetworkError } from './useSyncStore'
import { useMemoryStore } from './useMemoryStore'

// The store owns STATE: optimistic updates, rollback, the offline queue
// hand-off, and realtime reconciliation. All Supabase IO lives in lib/api —
// never call supabase from here or from components.

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
  /** Create a list; optional starter items (from a template) are inserted with it. */
  createList: (params: { name: string; type: List['type']; emoji: string; items?: { title: string; category?: string }[] }) => Promise<List | null>
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
  /** Permanently delete every completed item on a list. */
  deleteCompleted: (listId: string) => Promise<void>
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

function bumpUpdatedAt(listId: string, get: Get, set: Set) {
  const now = new Date().toISOString()
  const list = get().lists.find(l => l.id === listId)
  const prev = list?.updated_at
  set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: now } : l) })
  listsApi.touchList(listId).then(ok => {
    if (!ok) set({ lists: get().lists.map(l => l.id === listId ? { ...l, updated_at: prev ?? now } : l) })
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
      const all = await listsApi.fetchAllLists(userId)
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
      const all = await listsApi.fetchAllLists(userId)
      if (all === null) { set({ loading: false, loadError: true }); return }
      set({ lists: all, loading: false, initialized: true })
    } catch {
      set({ loading: false, loadError: true })
    }
  },

  createList: async ({ name, type, emoji, items }) => {
    const { userId, displayName } = get()
    const list = await listsApi.insertList({ name, type, emoji, owner_id: userId })
    if (!list) { set({ lastError: "Couldn't create list — try again" }); return null }
    await listsApi.insertOwnerMembership(list.id, userId, displayName)
    if (items?.length) {
      await listsApi.copyItems(
        items.map((t, i) => ({ title: t.title, quantity: null, category: t.category ?? null, sort_order: i })),
        list.id, displayName,
      )
      await get().loadItems(list.id)
    }
    set({ lists: [list, ...get().lists] })
    return list
  },

  renameList: async (listId, name) => {
    const trimmed = name.trim().slice(0, 100)
    if (!trimmed) return
    const prev = get().lists
    set({ lists: prev.map(l => l.id === listId ? { ...l, name: trimmed } : l) })
    const ok = await listsApi.updateList(listId, { name: trimmed })
    if (!ok) set({ lists: prev, lastError: "Couldn't rename — try again" })
  },

  deleteList: async (listId) => {
    const ok = await listsApi.deleteList(listId)
    if (!ok) { set({ lastError: "Couldn't delete list — try again" }); return }
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
    const newList = await listsApi.insertList({ name: `${orig.name} (copy)`, type: orig.type, emoji: orig.emoji, owner_id: userId })
    if (!newList) return
    await listsApi.insertOwnerMembership(newList.id, userId, displayName)
    await listsApi.copyItems(get().items[listId] ?? [], newList.id, displayName)
    set({ lists: [newList, ...get().lists] })
  },

  saveAsTemplate: async (listId) => {
    const { userId, displayName } = get()
    const orig = get().lists.find(l => l.id === listId)
    if (!orig) return
    const tpl = await listsApi.insertList({ name: orig.name, type: orig.type, emoji: orig.emoji, owner_id: userId, is_template: true })
    if (!tpl) { set({ lastError: "Couldn't save template — try again" }); return }
    await listsApi.insertOwnerMembership(tpl.id, userId, displayName)
    await listsApi.copyItems(get().items[listId] ?? [], tpl.id, displayName)
    set({ lists: [tpl, ...get().lists] })
  },

  // Template from arbitrary items (e.g. Insights "Suggested for You").
  createTemplate: async (name, emoji, tplItems) => {
    const { userId, displayName } = get()
    const tpl = await listsApi.insertList({ name, type: 'shopping', emoji, owner_id: userId, is_template: true })
    if (!tpl) { set({ lastError: "Couldn't save template — try again" }); return }
    await listsApi.insertOwnerMembership(tpl.id, userId, displayName)
    await listsApi.copyItems(tplItems.map((t, i) => ({ title: t.title, quantity: null, category: t.category, sort_order: i })), tpl.id, displayName)
    set({ lists: [tpl, ...get().lists] })
  },

  createFromTemplate: async (templateId) => {
    const { userId, displayName } = get()
    const tpl = get().lists.find(l => l.id === templateId)
    if (!tpl) return null
    const list = await listsApi.insertList({ name: tpl.name, type: tpl.type, emoji: tpl.emoji, owner_id: userId })
    if (!list) { set({ lastError: "Couldn't create list — try again" }); return null }
    await listsApi.insertOwnerMembership(list.id, userId, displayName)
    if (!get().items[templateId]) await get().loadItems(templateId)
    await listsApi.copyItems(get().items[templateId] ?? [], list.id, displayName)
    set({ lists: [list, ...get().lists] })
    return list
  },

  setArchived: async (listId, archived) => {
    const prev = get().lists
    const archived_at = archived ? new Date().toISOString() : null
    set({ lists: prev.map(l => l.id === listId ? { ...l, archived_at } : l) })
    const ok = await listsApi.updateList(listId, { archived_at })
    if (!ok) set({ lists: prev, lastError: archived ? "Couldn't archive — try again" : "Couldn't restore — try again" })
  },

  leaveList: async (listId) => {
    const { userId } = get()
    // Requires the "members can leave" delete policy (migration v9).
    const ok = await membersApi.leaveList(listId, userId)
    if (!ok) {
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
    const items = await itemsApi.fetchItems(listId)
    // Offline / transient failure: keep the cached items rather than wiping.
    if (items === null) return
    // A fetch that was in flight when offline adds happened must never
    // clobber them: carry over local temp rows the server doesn't know yet
    // (the sync engine swaps them for real rows on replay).
    const temps = (get().items[listId] ?? []).filter(i => isTempId(i.id))
    set({ items: { ...get().items, [listId]: [...items, ...temps] } })
  },

  loadMembers: async (listId) => {
    const members = await membersApi.fetchMembers(listId)
    // Don't overwrite existing members with [] on error — keep whatever we
    // last had so shared indicators don't blink out.
    if (members === null) return
    set({ members: { ...get().members, [listId]: members } })
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
    const { data, error } = await itemsApi.insertItem({
      list_id: listId, title, quantity: quantity || null, category, added_by_name: displayName,
    })
    if (error || !data) {
      if (isNetworkError(error?.message)) { addOffline(); return }
      set({ lastError: "Couldn't add item — try again" })
      return
    }
    const current = get().items[listId] ?? []
    if (!current.find(i => i.id === data.id))
      set({ items: { ...get().items, [listId]: [...current, data] } })
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
    const { error } = await itemsApi.updateItem(item.id, patch)
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
    const { error } = await itemsApi.updateItem(itemId, patch)
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
    const { error } = await itemsApi.deleteItemById(itemId)
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
    const { error } = await itemsApi.uncheckAllItems(listId)
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't save — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  deleteCompleted: async (listId) => {
    const prev = get().items[listId] ?? []
    const completed = prev.filter(i => i.completed)
    if (completed.length === 0) return
    set({ items: { ...get().items, [listId]: prev.filter(i => !i.completed) } })
    const sync = useSyncStore.getState()
    // Temp items never reached the server — just cancel their queued ops.
    completed.filter(i => isTempId(i.id)).forEach(i => sync.dropForItem(i.id))
    const real = completed.filter(i => !isTempId(i.id))
    if (real.length === 0) return
    if (!sync.online) {
      real.forEach(i => sync.enqueue({ kind: 'delete', opId: newOpId(), listId, itemId: i.id }))
      return
    }
    const { error } = await itemsApi.deleteCompletedItems(listId)
    if (error) {
      if (isNetworkError(error.message)) {
        real.forEach(i => sync.enqueue({ kind: 'delete', opId: newOpId(), listId, itemId: i.id }))
        return
      }
      set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't clear completed — try again" })
    }
    else bumpUpdatedAt(listId, get, set)
  },

  clearItems: async (listId) => {
    const prev = get().items[listId] ?? []
    set({ items: { ...get().items, [listId]: [] } })
    const { error } = await itemsApi.deleteAllItems(listId)
    if (error) set({ items: { ...get().items, [listId]: prev }, lastError: "Couldn't clear items — try again" })
    else bumpUpdatedAt(listId, get, set)
  },

  removeMember: async (listId, memberId) => {
    const prev = get().members[listId] ?? []
    set({ members: { ...get().members, [listId]: prev.filter(m => m.id !== memberId) } })
    const ok = await membersApi.removeMember(listId, memberId)
    if (!ok) set({ members: { ...get().members, [listId]: prev }, lastError: "Couldn't remove member" })
  },

  setMemberRole: async (listId, memberId, role) => {
    const prev = get().members[listId] ?? []
    set({ members: { ...get().members, [listId]: prev.map(m => m.id === memberId ? { ...m, role } : m) } })
    const ok = await membersApi.setMemberRole(memberId, role)
    if (!ok) set({ members: { ...get().members, [listId]: prev }, lastError: "Couldn't change access" })
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
    const { list, errorMessage } = await invitesApi.redeemInvite(clean, displayName)
    if (errorMessage) {
      if (errorMessage.includes('own_list'))       return { success: false, message: 'You already own this list' }
      if (errorMessage.includes('already_member')) return { success: false, message: 'Already joined' }
      if (errorMessage.includes('expired_code'))   return { success: false, message: 'This invite link has expired' }
      return { success: false, message: 'Invalid invite code' }
    }
    if (!list) return { success: false, message: 'Invalid invite code' }
    if (get().lists.some(l => l.id === list.id)) return { success: true, message: `Already joined "${list.name}"`, list }
    set({ lists: [list, ...get().lists] })
    return { success: true, message: `Joined "${list.name}"`, list }
  },

  regenerateInvite: async (listId, role = 'collaborator') => invitesApi.rotateInvite(listId, role),

  getInvite: async (listId) => invitesApi.getInvite(listId),

  resolveListIdByCode: async (code) => invitesApi.resolveListIdByCode(code),

  getInvitePreview: async (code) => invitesApi.fetchInvitePreview(code),

  subscribeToList: (listId) => {
    return itemsApi.subscribeToItems(listId, {
      onInsert: (item) => {
        const current = get().items[listId] ?? []
        if (!current.find(i => i.id === item.id))
          set({ items: { ...get().items, [listId]: [...current, item] } })
      },
      onUpdate: (item) => {
        const current = get().items[listId] ?? []
        set({ items: { ...get().items, [listId]: current.map(i => i.id === item.id ? item : i) } })
      },
      onDelete: (id) => {
        const current = get().items[listId] ?? []
        set({ items: { ...get().items, [listId]: current.filter(i => i.id !== id) } })
      },
      // Channel recovered after a drop — data may have been missed meanwhile.
      onResubscribe: () => { get().loadItems(listId); get().loadMembers(listId) },
    })
  },
}), {
  // Offline-first cache: lists/items/members render instantly on cold start
  // and stay readable with no network. Only data is persisted — transient
  // flags and functions are rebuilt each session.
  name: storageKeys.listsCache,
  partialize: (s) => ({
    lists: s.lists, items: s.items, members: s.members,
    userId: s.userId, displayName: s.displayName,
  }),
}))
