import { describe, expect, it } from 'vitest'
import { PW_RULES, passwordRulesPassed, isPasswordValid } from './password'

describe('password policy', () => {
  it('accepts a password meeting all four rules', () => {
    expect(isPasswordValid('Abcd123!')).toBe(true)
  })

  it('rejects each missing rule', () => {
    expect(isPasswordValid('abcd123!')).toBe(false) // no uppercase
    expect(isPasswordValid('Abcdefg!')).toBe(false) // no number
    expect(isPasswordValid('Abcd1234')).toBe(false) // no special char
    expect(isPasswordValid('Ab1!')).toBe(false)     // too short
    expect(isPasswordValid('')).toBe(false)
  })

  it('reports partial progress for the strength meter', () => {
    expect(passwordRulesPassed('abcdefgh')).toHaveLength(1) // length only
    expect(passwordRulesPassed('Abcd123!')).toHaveLength(PW_RULES.length)
  })
})
