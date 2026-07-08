import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storageKeys, readJSON, writeJSON, getDefaultListType } from './storage'

// Deterministic Storage stub — Node's own experimental localStorage global
// shadows jsdom's and lacks parts of the API depending on runtime flags.
const backing = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => { backing.set(k, String(v)) },
  removeItem: (k: string) => { backing.delete(k) },
  clear: () => { backing.clear() },
})

describe('storage', () => {
  beforeEach(() => backing.clear())

  it('round-trips JSON values', () => {
    writeJSON(storageKeys.pins('u1'), ['a', 'b'])
    expect(readJSON<string[]>(storageKeys.pins('u1'), [])).toEqual(['a', 'b'])
  })

  it('falls back on missing keys and corrupt data', () => {
    expect(readJSON('missing', 'fallback')).toBe('fallback')
    backing.set('corrupt', '{not json')
    expect(readJSON('corrupt', 42)).toBe(42)
  })

  it('per-list keys are namespaced by id', () => {
    expect(storageKeys.viewPrefs('l1')).not.toBe(storageKeys.viewPrefs('l2'))
    expect(storageKeys.viewPrefs('l1')).toContain('l1')
  })

  it('getDefaultListType validates the stored value', () => {
    expect(getDefaultListType()).toBe('personal')
    backing.set(storageKeys.defaultListType, 'shopping')
    expect(getDefaultListType()).toBe('shopping')
    backing.set(storageKeys.defaultListType, 'garbage')
    expect(getDefaultListType()).toBe('personal')
  })
})
