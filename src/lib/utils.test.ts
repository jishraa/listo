import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { friendlyName, formatQuantity, formatRelativeTime, capitalize } from './utils'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T15:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('uses minutes for recent activity', () => {
    expect(formatRelativeTime('2026-07-07T14:59:40')).toBe('just now')
    expect(formatRelativeTime('2026-07-07T14:55:00')).toBe('5m ago')
  })

  it('switches to calendar wording past an hour', () => {
    expect(formatRelativeTime('2026-07-07T09:00:00')).toBe('today')
    expect(formatRelativeTime('2026-07-06T23:00:00')).toBe('yesterday')
    expect(formatRelativeTime('2026-07-04T12:00:00')).toBe('3 days ago')
  })

  it('falls back to a short date after a week', () => {
    const out = formatRelativeTime('2026-06-01T12:00:00')
    expect(out).not.toMatch(/ago|today|yesterday/)
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('capitalize', () => {
  it('uppercases the first letter only', () => {
    expect(capitalize('rice')).toBe('Rice')
    expect(capitalize('basmati rice')).toBe('Basmati rice')
    expect(capitalize('')).toBe('')
  })
})

describe('friendlyName', () => {
  it('strips digits from technical usernames', () => {
    expect(friendlyName('anjana1995ks')).toBe('Anjana')
    expect(friendlyName('mary_jane99')).toBe('Mary')
  })

  it('uses the part before @ for emails', () => {
    expect(friendlyName('anjana@example.com')).toBe('Anjana')
  })

  it('keeps human names whole, capitalised', () => {
    expect(friendlyName('Anjana Kumar')).toBe('Anjana Kumar')
    expect(friendlyName('mary-jane')).toBe('Mary-jane')
    expect(friendlyName("o'brien")).toBe("O'brien")
    expect(friendlyName('j.doe')).toBe('J.doe')
  })

  it('returns the input when nothing usable is left', () => {
    expect(friendlyName('x9')).toBe('x9')
  })
})

describe('formatQuantity', () => {
  it('normalises number + unit', () => {
    expect(formatQuantity('2L')).toBe('2 L')
    expect(formatQuantity('5kg')).toBe('5 kg')
    expect(formatQuantity('500 g')).toBe('500 g')
  })

  it('drops the × count symbol', () => {
    expect(formatQuantity('×10')).toBe('10')
  })

  it('passes through unparseable values and empties', () => {
    expect(formatQuantity('3+2')).toBe('3+2')
    expect(formatQuantity(null)).toBe('')
    expect(formatQuantity('')).toBe('')
  })
})
