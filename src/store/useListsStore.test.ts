import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListItem } from '../types'

// Mock the entire repository layer — these tests exercise the store's
// optimistic updates, rollback, and offline-queue hand-off in isolation.
vi.mock('../lib/api/lists')
vi.mock('../lib/api/items')
vi.mock('../lib/api/members')
vi.mock('../lib/api/invites')
vi.mock('../lib/api/history')

import * as listsApi from '../lib/api/lists'
import * as itemsApi from '../lib/api/items'
import * as invitesApi from '../lib/api/invites'
import { useListsStore } from './useListsStore'
import { useSyncStore } from './useSyncStore'

// isNetworkError consults navigator.onLine — pin it truthy so only the
// error message decides.
vi.stubGlobal('navigator', { onLine: true })

const serverItem = (over: Partial<ListItem> = {}): ListItem => ({
  id: 'srv-1', list_id: 'l1', title: 'Milk', quantity: null, completed: false,
  added_by_name: 'Tester', completed_by_name: null, completed_at: null,
  category: null, sort_order: 0, created_at: '2026-07-08T00:00:00Z', ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  useListsStore.setState({
    lists: [], items: {}, members: {}, loading: false, initialized: true,
    userId: 'u1', displayName: 'Tester', loadError: false, lastError: null,
  })
  useSyncStore.setState({ online: true, syncing: false, queue: [] })
  vi.mocked(listsApi.touchList).mockResolvedValue(true)
})

describe('addItem', () => {
  it('appends the server row on success and bumps the list', async () => {
    vi.mocked(itemsApi.insertItem).mockResolvedValue({ data: serverItem(), error: null })
    await useListsStore.getState().addItem('l1', 'Milk', '', null)
    expect(useListsStore.getState().items.l1).toHaveLength(1)
    expect(useListsStore.getState().items.l1[0].id).toBe('srv-1')
    expect(listsApi.touchList).toHaveBeenCalledWith('l1')
  })

  it('offline: applies a temp row and queues the insert instead of calling the api', async () => {
    useSyncStore.setState({ online: false })
    await useListsStore.getState().addItem('l1', 'Milk', '2L', null)
    expect(itemsApi.insertItem).not.toHaveBeenCalled()
    const items = useListsStore.getState().items.l1
    expect(items).toHaveLength(1)
    expect(items[0].id).toMatch(/^local-/)
    const queue = useSyncStore.getState().queue
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ kind: 'add', title: 'Milk', quantity: '2L' })
  })

  it('network failure mid-flight falls back to the offline path', async () => {
    vi.mocked(itemsApi.insertItem).mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await useListsStore.getState().addItem('l1', 'Milk', '', null)
    expect(useListsStore.getState().items.l1[0].id).toMatch(/^local-/)
    expect(useSyncStore.getState().queue).toHaveLength(1)
  })

  it('rejection (non-network) surfaces an error and adds nothing', async () => {
    vi.mocked(itemsApi.insertItem).mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    await useListsStore.getState().addItem('l1', 'Milk', '', null)
    expect(useListsStore.getState().items.l1 ?? []).toHaveLength(0)
    expect(useSyncStore.getState().queue).toHaveLength(0)
    expect(useListsStore.getState().lastError).toContain("Couldn't add item")
  })
})

describe('toggleItem', () => {
  it('optimistically completes, then rolls back on rejection', async () => {
    const item = serverItem()
    useListsStore.setState({ items: { l1: [item] } })
    let resolve!: (v: { error: { message: string } }) => void
    vi.mocked(itemsApi.updateItem).mockReturnValue(new Promise(r => { resolve = r }))

    const done = useListsStore.getState().toggleItem('l1', item)
    // Optimistic: completed immediately, before the api settles
    expect(useListsStore.getState().items.l1[0].completed).toBe(true)

    resolve({ error: { message: 'permission denied' } })
    await done
    expect(useListsStore.getState().items.l1[0].completed).toBe(false)
    expect(useListsStore.getState().lastError).toContain("Couldn't save")
  })

  it('queues the patch and keeps the optimistic state on network failure', async () => {
    const item = serverItem()
    useListsStore.setState({ items: { l1: [item] } })
    vi.mocked(itemsApi.updateItem).mockResolvedValue({ error: { message: 'network error' } })
    await useListsStore.getState().toggleItem('l1', item)
    expect(useListsStore.getState().items.l1[0].completed).toBe(true)
    expect(useSyncStore.getState().queue[0]).toMatchObject({ kind: 'update', itemId: 'srv-1' })
  })
})

describe('deleteCompleted', () => {
  it('offline: removes locally, queues real rows, drops temp rows from the queue', async () => {
    useSyncStore.setState({
      online: false,
      queue: [{ kind: 'add', opId: 'op1', listId: 'l1', tempId: 'local-x', title: 'T', quantity: null, category: null, addedByName: 'Tester' }],
    })
    useListsStore.setState({ items: { l1: [
      serverItem({ id: 'srv-1', completed: true }),
      serverItem({ id: 'local-x', completed: true }),
      serverItem({ id: 'srv-2', completed: false }),
    ] } })
    await useListsStore.getState().deleteCompleted('l1')
    expect(useListsStore.getState().items.l1.map(i => i.id)).toEqual(['srv-2'])
    // The temp item's pending add was cancelled; only the real delete queued
    const queue = useSyncStore.getState().queue
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ kind: 'delete', itemId: 'srv-1' })
  })
})

describe('loadItems', () => {
  it('keeps the cache when the fetch fails', async () => {
    useListsStore.setState({ items: { l1: [serverItem()] } })
    vi.mocked(itemsApi.fetchItems).mockResolvedValue(null)
    await useListsStore.getState().loadItems('l1')
    expect(useListsStore.getState().items.l1).toHaveLength(1)
  })

  it('never clobbers unsynced temp rows with a late server response', async () => {
    // Regression: a loadItems in flight when offline adds happen must not
    // wipe the optimistic temp rows when its (stale) response lands.
    useListsStore.setState({ items: { l1: [serverItem({ id: 'local-temp1', title: 'Bananas' })] } })
    vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
    await useListsStore.getState().loadItems('l1')
    expect(useListsStore.getState().items.l1.map(i => i.id)).toEqual(['local-temp1'])
  })
})

describe('joinByCode', () => {
  it('rejects malformed codes without touching the api', async () => {
    const res = await useListsStore.getState().joinByCode('!!')
    expect(res).toEqual({ success: false, message: 'Invalid invite code' })
    expect(invitesApi.redeemInvite).not.toHaveBeenCalled()
  })

  it('maps rpc errors to friendly messages', async () => {
    vi.mocked(invitesApi.redeemInvite).mockResolvedValue({ list: null, errorMessage: 'own_list' })
    const res = await useListsStore.getState().joinByCode('abcd1234')
    expect(res.message).toBe('You already own this list')
  })
})
