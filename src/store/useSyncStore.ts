import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKeys } from '../lib/storage'
import * as itemsApi from '../lib/api/items'
import { useListsStore } from './useListsStore'

// Offline mutation queue (offline-first part C). Item-level writes made with
// no network are applied optimistically, persisted here, and replayed FIFO
// when connectivity returns. Conflict strategy is last-write-wins; ops
// against rows that were deleted remotely (or whose permissions changed)
// fail permanently and are dropped rather than blocking the queue.
// List-level operations (create/rename/share/archive/delete) stay
// online-only in V1.

export type ItemPatch = {
  title?: string; quantity?: string | null; category?: string | null
  completed?: boolean; completed_by_name?: string | null; completed_at?: string | null
}

export type PendingOp =
  | { kind: 'add'; opId: string; listId: string; tempId: string; title: string; quantity: string | null; category: string | null; addedByName: string }
  | { kind: 'update'; opId: string; listId: string; itemId: string; patch: ItemPatch }
  | { kind: 'delete'; opId: string; listId: string; itemId: string }

export const newOpId = () => `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
export const newTempId = () => `local-${crypto.randomUUID()}`
export const isTempId = (id: string) => id.startsWith('local-')

// True when the failure smells like connectivity rather than a rejection —
// those ops stay queued; everything else is dropped (retrying won't help).
export const isNetworkError = (msg?: string) =>
  !navigator.onLine || /fetch|network|load failed|timed?\s?out/i.test(msg ?? '')

interface SyncState {
  online: boolean
  syncing: boolean
  queue: PendingOp[]
  setOnline: (v: boolean) => void
  enqueue: (op: PendingOp) => void
  /** Remove every queued op touching an item (used when a temp item is deleted before syncing). */
  dropForItem: (itemId: string) => void
  flush: () => Promise<void>
  clear: () => void
}

async function processOp(op: PendingOp): Promise<'done' | 'retry'> {
  if (op.kind === 'add') {
    const { data, error } = await itemsApi.insertItem({
      list_id: op.listId, title: op.title, quantity: op.quantity,
      category: op.category, added_by_name: op.addedByName,
    })
    if (error || !data) return isNetworkError(error?.message) ? 'retry' : 'done'
    // Swap the temp row for the server row and repoint any queued ops at it.
    const lists = useListsStore.getState()
    useListsStore.setState({
      items: { ...lists.items, [op.listId]: (lists.items[op.listId] ?? []).map(i => i.id === op.tempId ? data : i) },
    })
    useSyncStore.setState({
      queue: useSyncStore.getState().queue.map(q =>
        q.kind !== 'add' && q.itemId === op.tempId ? { ...q, itemId: data.id } : q),
    })
    return 'done'
  }
  // An update/delete still pointing at a temp id means its add was dropped —
  // nothing on the server to touch.
  if (isTempId(op.itemId)) return 'done'
  if (op.kind === 'update') {
    const { error } = await itemsApi.updateItem(op.itemId, op.patch)
    return error && isNetworkError(error.message) ? 'retry' : 'done'
  }
  const { error } = await itemsApi.deleteItemById(op.itemId)
  return error && isNetworkError(error.message) ? 'retry' : 'done'
}

export const useSyncStore = create<SyncState>()(persist((set, get) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  queue: [],

  setOnline: (v) => set({ online: v }),
  enqueue: (op) => set({ queue: [...get().queue, op] }),
  dropForItem: (itemId) => set({
    queue: get().queue.filter(op =>
      op.kind === 'add' ? op.tempId !== itemId : op.itemId !== itemId),
  }),
  clear: () => set({ queue: [], syncing: false }),

  flush: async () => {
    if (get().syncing || !get().online || get().queue.length === 0) return
    set({ syncing: true })
    try {
      while (get().queue.length > 0) {
        const op = get().queue[0]
        const outcome = await processOp(op)
        if (outcome === 'retry') break
        set({ queue: get().queue.slice(1) })
      }
    } finally {
      set({ syncing: false })
    }
  },
}), {
  name: storageKeys.syncQueue,
  partialize: (s) => ({ queue: s.queue }),
}))
