import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListItem } from '../types'

vi.mock('../lib/api/lists')
vi.mock('../lib/api/items')
vi.mock('../lib/api/members')
vi.mock('../lib/api/invites')
vi.mock('../lib/api/history')

import * as itemsApi from '../lib/api/items'
import { useSyncStore, type PendingOp } from './useSyncStore'
import { useListsStore } from './useListsStore'

vi.stubGlobal('navigator', { onLine: true })

const addOp = (tempId = 'local-1'): PendingOp => ({
  kind: 'add', opId: 'op-add', listId: 'l1', tempId,
  title: 'Milk', quantity: '2L', category: null, addedByName: 'Tester',
})

const serverRow: ListItem = {
  id: 'srv-9', list_id: 'l1', title: 'Milk', quantity: '2L', completed: false,
  added_by_name: 'Tester', completed_by_name: null, completed_at: null,
  category: null, sort_order: 0, created_at: '2026-07-08T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  useSyncStore.setState({ online: true, syncing: false, queue: [] })
  useListsStore.setState({ items: {}, lists: [], members: {} })
})

describe('flush', () => {
  it('replays an add: swaps the temp row and repoints queued ops at the server id', async () => {
    useListsStore.setState({ items: { l1: [{ ...serverRow, id: 'local-1' }] } })
    useSyncStore.setState({ queue: [
      addOp('local-1'),
      { kind: 'update', opId: 'op-u', listId: 'l1', itemId: 'local-1', patch: { completed: true } },
    ] })
    vi.mocked(itemsApi.insertItem).mockResolvedValue({ data: serverRow, error: null })
    vi.mocked(itemsApi.updateItem).mockResolvedValue({ error: null })

    await useSyncStore.getState().flush()

    expect(useSyncStore.getState().queue).toHaveLength(0)
    expect(useListsStore.getState().items.l1[0].id).toBe('srv-9')
    // The follow-up update ran against the REAL id, not the temp one
    expect(itemsApi.updateItem).toHaveBeenCalledWith('srv-9', { completed: true })
  })

  it('keeps the op and stops on connectivity failures (retry later)', async () => {
    useSyncStore.setState({ queue: [addOp()] })
    vi.mocked(itemsApi.insertItem).mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await useSyncStore.getState().flush()
    expect(useSyncStore.getState().queue).toHaveLength(1)
    expect(useSyncStore.getState().syncing).toBe(false)
  })

  it('drops ops that are rejected outright — retrying cannot help', async () => {
    useSyncStore.setState({ queue: [
      { kind: 'delete', opId: 'op-d', listId: 'l1', itemId: 'srv-1' },
    ] })
    vi.mocked(itemsApi.deleteItemById).mockResolvedValue({ error: { message: 'permission denied' } })
    await useSyncStore.getState().flush()
    expect(useSyncStore.getState().queue).toHaveLength(0)
  })

  it('skips update/delete ops still pointing at a temp id (their add was dropped)', async () => {
    useSyncStore.setState({ queue: [
      { kind: 'update', opId: 'op-u', listId: 'l1', itemId: 'local-gone', patch: { completed: true } },
    ] })
    await useSyncStore.getState().flush()
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
    expect(useSyncStore.getState().queue).toHaveLength(0)
  })
})

describe('dropForItem', () => {
  it('removes every queued op touching the item', () => {
    useSyncStore.setState({ queue: [
      addOp('local-1'),
      { kind: 'update', opId: 'op-u', listId: 'l1', itemId: 'local-1', patch: { completed: true } },
      { kind: 'delete', opId: 'op-d', listId: 'l1', itemId: 'other' },
    ] })
    useSyncStore.getState().dropForItem('local-1')
    expect(useSyncStore.getState().queue).toHaveLength(1)
    expect(useSyncStore.getState().queue[0].opId).toBe('op-d')
  })
})
