// Single source of truth for the password policy — used by both the sign-up
// screen and the password-reset screen so a reset can't set a weaker password
// than sign-up would allow.
export const PW_RULES = [
  { id: 'len',     label: 'Minimum 8 characters',   test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter',   test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num',     label: 'One number',             test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'One special character',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export const passwordRulesPassed = (pw: string) => PW_RULES.filter(r => r.test(pw))
export const isPasswordValid = (pw: string) => PW_RULES.every(r => r.test(pw))
