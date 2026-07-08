import { describe, expect, it } from 'vitest'
import type { ListItem } from '../../types'
import {
  computeHealth, computeBehaviour, computeCatStats, computeCandidates,
  computeTrends, varietyInsight, memberActivity, duplicateTitleCount, forgottenCount,
} from './analytics'
import { LIST_CATEGORIES } from '../../lib/constants'

let n = 0
const item = (title: string, over: Partial<ListItem> = {}): ListItem => ({
  id: `i${n++}`, list_id: 'l1', title, quantity: null, completed: false,
  added_by_name: 'Me', completed_by_name: null, completed_at: null,
  category: null, sort_order: 0, created_at: '2026-07-01T10:00:00Z', ...over,
})

describe('computeHealth', () => {
  it('scores a perfect list at 100 with no headroom', () => {
    const h = computeHealth({ pct: 100, catPct: 100, dupeCount: 0, forgotten: 0, pending: 0, uncat: 0 })
    expect(h.score).toBe(100)
    expect(h.potential).toBe(0)
    expect(h.checklist.every(c => c.ok)).toBe(true)
  })

  it('penalizes duplicates/forgotten and reports headroom', () => {
    const h = computeHealth({ pct: 50, catPct: 40, dupeCount: 2, forgotten: 1, pending: 5, uncat: 3 })
    expect(h.score).toBe(Math.round(50 * 0.55 + 40 * 0.25))
    expect(h.potential).toBeGreaterThan(0)
    expect(h.checklist.filter(c => !c.ok)).toHaveLength(4)
  })
})

describe('computeCandidates — predicted next list', () => {
  const itemsByList = {
    a: [item('Milk'), item('Eggs'), item('Rice')],
    b: [item('Milk'), item('Eggs'), item('Ghee')],
    c: [item('Milk')],
  }

  it('suggests only items bought 2+ times, most frequent first', () => {
    const { candidates } = computeCandidates(['a', 'b', 'c'], itemsByList, [])
    expect(candidates.map(c => c.title)).toEqual(['Milk', 'Eggs'])
    expect(candidates[0].count).toBe(3)
  })

  it('excludes items already pending on the current list', () => {
    const { candidates } = computeCandidates(['a', 'b', 'c'], itemsByList, [item('milk')])
    expect(candidates.map(c => c.title)).toEqual(['Eggs'])
  })

  it('keeps confidence within its 20–95 bounds', () => {
    expect(computeCandidates(['a', 'b', 'c'], itemsByList, []).confidence).toBeLessThanOrEqual(95)
    expect(computeCandidates(['a'], { a: [item('One-off')] }, []).confidence).toBeGreaterThanOrEqual(20)
    expect(computeCandidates([], {}, []).confidence).toBe(0)
  })
})

describe('computeCatStats + varietyInsight', () => {
  const cats = LIST_CATEGORIES.shopping
  const items = [
    ...Array.from({ length: 6 }, () => item('Apple', { category: 'produce', completed: true })),
    item('Milk', { category: 'dairy' }),
    item('Chips', { category: 'snacks' }),
  ]

  it('aggregates per category, largest first', () => {
    const stats = computeCatStats(cats, items)
    expect(stats[0]).toMatchObject({ id: 'produce', total: 6, done: 6 })
    expect(stats).toHaveLength(3)
  })

  it('flags a dominating category (>50%)', () => {
    const v = varietyInsight(computeCatStats(cats, items), items.length)
    expect(v?.sub).toContain('dominates')
  })

  it('stays quiet on small lists', () => {
    expect(varietyInsight(computeCatStats(cats, items.slice(0, 3)), 3)).toBeNull()
  })
})

describe('computeTrends', () => {
  it('clamps ±3pt noise to 0 and reports real shifts', () => {
    const cats = LIST_CATEGORIES.shopping
    const current = [
      item('A', { category: 'produce' }), item('B', { category: 'produce' }),
      item('C', { category: 'dairy' }), item('D', { category: 'dairy' }),
    ]
    const prev = { p: [item('X', { category: 'produce' }), item('Y', { category: 'dairy' }), item('Z', { category: 'dairy' }), item('W', { category: 'dairy' })] }
    const trends = computeTrends(['p'], prev, computeCatStats(cats, current), current.length)
    const produce = trends.find(t => t.id === 'produce')!
    const dairy = trends.find(t => t.id === 'dairy')!
    expect(produce.diff).toBe(25)   // 50% now vs 25% before
    expect(dairy.diff).toBe(-25)
  })
})

describe('behaviour, duplicates, forgotten, members', () => {
  it('finds the most active weekday and average list size', () => {
    const tue = '2026-07-07T10:00:00Z' // a Tuesday
    const b = computeBehaviour(['a', 'b'], {
      a: [item('X', { completed: true, completed_at: tue }), item('Y', { completed: true, completed_at: tue })],
      b: [item('Z', { completed: true, completed_at: '2026-07-05T10:00:00Z' })],
    })
    expect(b.day).toBe('Tuesday')
    expect(b.avg).toBe(2) // (2 + 1) / 2 rounded
    expect(b.listCount).toBe(2)
  })

  it('counts duplicate titles case-insensitively across statuses', () => {
    expect(duplicateTitleCount([item('Milk'), item('milk', { completed: true }), item('Eggs')])).toBe(1)
  })

  it('sums pending items across archived lists', () => {
    expect(forgottenCount(['a', 'b'], {
      a: [item('X'), item('Y', { completed: true })],
      b: [item('Z')],
    })).toBe(2)
  })

  it('reports top adder/completer only for shared lists', () => {
    const items = [
      item('A', { added_by_name: 'Anu' }), item('B', { added_by_name: 'Anu' }),
      item('C', { added_by_name: 'Ravi', completed: true, completed_by_name: 'Ravi' }),
    ]
    expect(memberActivity(items, 1)).toBeNull()
    const m = memberActivity(items, 2)!
    expect(m.topAdder![0]).toBe('Anu')
    expect(m.topCompleter![0]).toBe('Ravi')
  })
})
