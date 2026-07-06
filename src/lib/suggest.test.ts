import { describe, it, expect } from 'vitest'
import { suggestListMeta, LIST_TYPE_ICONS } from './constants'

describe('suggestListMeta', () => {
  // The examples called out in the Create List spec (§5 / §11)
  it.each([
    ['July Groceries',   'shopping', '🛒'],
    ['Office Tasks',     'tasks',    '💼'],
    ['Office Work',      'tasks',    '💼'],
    ['Weekend Trip',     'personal', '✈️'],
    ['Vacation Packing', 'personal', '✈️'],
    ['Home Chores',      'tasks',    '🏠'],
  ] as const)('%s → %s + %s', (name, type, emoji) => {
    expect(suggestListMeta(name)).toEqual({ type, emoji })
  })

  it('returns null when nothing clearly matches', () => {
    expect(suggestListMeta('asdfqwer')).toBeNull()
    expect(suggestListMeta('')).toBeNull()
    expect(suggestListMeta('   ')).toBeNull()
  })

  it('is case-insensitive and matches substrings', () => {
    expect(suggestListMeta('MY GROCERY RUN')?.type).toBe('shopping')
    expect(suggestListMeta('Travelling soon')?.type).toBe('personal')
  })

  it('every list type exposes a short, non-empty icon set', () => {
    for (const type of ['personal', 'tasks', 'shopping'] as const) {
      expect(LIST_TYPE_ICONS[type].length).toBeGreaterThan(0)
      expect(LIST_TYPE_ICONS[type].length).toBeLessThanOrEqual(6)
    }
  })
})
