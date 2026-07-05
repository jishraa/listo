import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  pendingDuplicateGroups,
  hasCompletedMatch,
  findPendingMergeTarget,
  analyzeGroup,
} from './duplicates'
import type { ListItem } from '../types'

let idc = 0
const item = (title: string, opts: { quantity?: string | null; completed?: boolean } = {}): ListItem => ({
  id: `i${idc++}`,
  list_id: 'l',
  title,
  quantity: opts.quantity ?? null,
  completed: opts.completed ?? false,
  added_by_name: 'me',
  completed_by_name: opts.completed ? 'me' : null,
  completed_at: opts.completed ? '2026-07-01T00:00:00Z' : null,
  category: null,
  sort_order: 0,
  created_at: '2026-07-01T00:00:00Z',
})

// The required test matrix from the spec. "Add X" is modelled as the list state
// AFTER the add (a new pending row), which is what the UI evaluates.

describe('Scenario 1 — exact pending duplicate → Review', () => {
  it('groups two pending same-name items and flags exact', () => {
    const items = [item('Mutton'), item('Mutton')]
    const groups = pendingDuplicateGroups(items)
    expect(groups.size).toBe(1)
    const g = groups.get('mutton')!
    expect(g).toHaveLength(2)
    expect(analyzeGroup(g).kind).toBe('exact')
  })
})

describe('Scenario 2 — pending item with compatible quantity → Merge', () => {
  it('finds the pending merge target and merges quantities', () => {
    const existing = [item('Mutton', { quantity: '1kg' })]
    expect(findPendingMergeTarget(existing, 'Mutton')?.quantity).toBe('1kg')
    const plan = analyzeGroup([item('Mutton', { quantity: '1kg' }), item('Mutton', { quantity: '2kg' })])
    expect(plan.kind).toBe('mergeable')
    expect(plan.merged).toBe('3kg')
  })
})

describe('Scenario 3 — pending item without quantity → ambiguous review', () => {
  it('does not auto-merge and analyzes as ambiguous', () => {
    // Existing pending has no quantity → no merge target.
    expect(findPendingMergeTarget([item('Mutton')], 'Mutton')).toBeNull()
    const plan = analyzeGroup([item('Mutton'), item('Mutton', { quantity: '1kg' })])
    expect(plan.kind).toBe('ambiguous')
  })
})

describe('Scenario 4 — completed item + new item → add as new pending', () => {
  it('does not group and reports a repeat purchase', () => {
    // findPendingMergeTarget runs at add-time against the EXISTING items.
    const existing = [item('Mutton', { completed: true })]
    expect(findPendingMergeTarget(existing, 'Mutton')).toBeNull()
    expect(hasCompletedMatch(existing, 'Mutton')).toBe(true)
    // After the add, the pending grouping still sees no duplicate.
    const afterAdd = [...existing, item('Mutton', { quantity: '1kg' })]
    expect(pendingDuplicateGroups(afterAdd).size).toBe(0)
  })
})

describe('Scenario 5 — exact completed item added again → new pending', () => {
  it('does not group even for identical name + quantity', () => {
    const existing = [item('Mutton', { quantity: '1kg', completed: true })]
    expect(findPendingMergeTarget(existing, 'Mutton')).toBeNull()
    expect(hasCompletedMatch(existing, 'Mutton')).toBe(true)
    const afterAdd = [...existing, item('Mutton', { quantity: '1kg' })]
    expect(pendingDuplicateGroups(afterAdd).size).toBe(0)
  })
})

describe('Scenario 6 — multiple completed matches → new pending', () => {
  it('ignores all completed items', () => {
    const items = [
      item('Mutton', { completed: true }),
      item('Mutton', { quantity: '1kg', completed: true }),
      item('Mutton', { quantity: '2kg' }),
    ]
    expect(pendingDuplicateGroups(items).size).toBe(0)
  })
})

describe('Scenario 7 — pending and completed matches → compare only pending', () => {
  it('merges against the pending item, ignoring the completed one', () => {
    // Existing at add-time: a completed Mutton and a pending Mutton 1kg.
    const existing = [item('Mutton', { completed: true }), item('Mutton', { quantity: '1kg' })]
    const target = findPendingMergeTarget(existing, 'Mutton')
    expect(target?.completed).toBe(false)
    expect(target?.quantity).toBe('1kg')
    // After adding Mutton 2kg, only the two pending items group (completed out).
    const afterAdd = [...existing, item('Mutton', { quantity: '2kg' })]
    expect(pendingDuplicateGroups(afterAdd).get('mutton')).toHaveLength(2)
  })
})

describe('Scenario 8 — completed different name → add normally', () => {
  it('does not match a different item name', () => {
    const items = [item('Chicken', { completed: true }), item('Chicken Breast')]
    expect(pendingDuplicateGroups(items).size).toBe(0)
    expect(hasCompletedMatch(items, 'Chicken Breast')).toBe(false)
  })
})

describe('Scenario 9 — pending different name → keep separate', () => {
  it('does not group different names', () => {
    const items = [item('Chicken'), item('Chicken Breast')]
    expect(pendingDuplicateGroups(items).size).toBe(0)
  })
})

describe('normalizeTitle', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeTitle('  Mutton  ')).toBe('mutton')
    expect(normalizeTitle('Chicken   Breast')).toBe('chicken breast')
  })
})
