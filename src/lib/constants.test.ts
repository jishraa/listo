import { describe, expect, it } from 'vitest'
import { parseItemInput, detectCategoryIn, suggestListMeta, LIST_CATEGORIES } from './constants'

const shopping = LIST_CATEGORIES.shopping

describe('parseItemInput — smart quantity parsing', () => {
  it('extracts explicit counts (x / ×)', () => {
    expect(parseItemInput('Milk x2')).toEqual({ item: 'Milk', qty: '×2' })
    expect(parseItemInput('Milk ×2')).toEqual({ item: 'Milk', qty: '×2' })
    expect(parseItemInput('Milk x 2')).toEqual({ item: 'Milk', qty: '×2' })
  })

  it('treats a count of 1 as the implicit default (no qty stored)', () => {
    expect(parseItemInput('Milk x1')).toEqual({ item: 'Milk', qty: '' })
    expect(parseItemInput('Apple 1')).toEqual({ item: 'Apple', qty: '' })
  })

  it('never splits an "x" inside a word', () => {
    // "Xbox 2" is a bare trailing count, not "Xbo ×2"
    expect(parseItemInput('Xbox 2')).toEqual({ item: 'Xbox', qty: '×2' })
  })

  it('extracts number + unit, dropping the inner space and keeping unit casing', () => {
    expect(parseItemInput('Rice 2kg')).toEqual({ item: 'Rice', qty: '2kg' })
    expect(parseItemInput('Rice 2 kg')).toEqual({ item: 'Rice', qty: '2kg' })
    expect(parseItemInput('Milk 1.5L')).toEqual({ item: 'Milk', qty: '1.5L' })
    expect(parseItemInput('Water 500ml')).toEqual({ item: 'Water', qty: '500ml' })
    expect(parseItemInput('Chips 2 packs')).toEqual({ item: 'Chips', qty: '2packs' })
  })

  it('treats a bare trailing number as a count, never inventing a unit', () => {
    expect(parseItemInput('Eggs 12')).toEqual({ item: 'Eggs', qty: '×12' })
  })

  it('passes plain items through untouched', () => {
    expect(parseItemInput('Milk')).toEqual({ item: 'Milk', qty: '' })
    expect(parseItemInput('  Milk  ')).toEqual({ item: 'Milk', qty: '' })
    expect(parseItemInput('Dozen eggs')).toEqual({ item: 'Dozen eggs', qty: '' })
  })

  it('never returns an empty item when the input is only a quantity', () => {
    expect(parseItemInput('2kg').item).toBe('2kg')
  })
})

describe('detectCategoryIn — keyword category matching', () => {
  it('matches known keywords case-insensitively', () => {
    expect(detectCategoryIn(shopping, 'Milk')).toBe('dairy')
    expect(detectCategoryIn(shopping, 'FRESH CHICKEN')).toBe('meat')
    expect(detectCategoryIn(shopping, 'Ice cream tub')).toBe('frozen')
  })

  it('matches whole words only — no substring false positives', () => {
    // "toilet paper" contains "oil" (pantry) as a substring — must be household
    expect(detectCategoryIn(shopping, 'Toilet paper')).toBe('household')
    // "popcorn" contains "corn" (produce) — must be snacks
    expect(detectCategoryIn(shopping, 'Popcorn')).toBe('snacks')
  })

  it('returns null for unknown items and empty input', () => {
    expect(detectCategoryIn(shopping, 'Mystery widget')).toBeNull()
    expect(detectCategoryIn(shopping, '   ')).toBeNull()
  })

  it('uses the caller-supplied categories (custom keywords)', () => {
    const custom = [{ id: 'baby', name: 'Baby', emoji: '🍼', color: '#fff', keywords: ['diapers'] }]
    expect(detectCategoryIn(custom, 'Diapers pack')).toBe('baby')
    expect(detectCategoryIn(custom, 'Milk')).toBeNull()
  })
})

describe('suggestListMeta — create-sheet type/icon suggestion', () => {
  it('suggests from name keywords', () => {
    expect(suggestListMeta('Weekend Trip')).toEqual({ type: 'personal', emoji: '✈️' })
    expect(suggestListMeta('Birthday Party')).toEqual({ type: 'personal', emoji: '🎉' })
    expect(suggestListMeta('Monthly groceries')).toEqual({ type: 'shopping', emoji: '🛒' })
    expect(suggestListMeta('Office work')).toEqual({ type: 'tasks', emoji: '💼' })
  })

  it('returns null when nothing clearly matches', () => {
    expect(suggestListMeta('Stuff')).toBeNull()
    expect(suggestListMeta('')).toBeNull()
  })
})
