import { describe, expect, it } from 'vitest'
import { friendlyName, formatQuantity } from './utils'

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
