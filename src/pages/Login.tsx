import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Check, ChevronLeft } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

// Friendly error copy (spec §7) — never surface raw backend messages.
function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('signups not allowed'))       return 'Registration is temporarily unavailable. Please try again later.'
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (m.includes('already registered'))        return 'An account with this email already exists. Try signing in.'
  if (m.includes('email not confirmed'))       return 'Please confirm your email first — check your inbox.'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'This sign-in method isn\'t available yet. Please use email instead.'
  if (m.includes('rate limit'))                return 'Too many attempts. Please wait a moment and try again.'
  if (m.includes('fetch'))                     return 'No internet connection. Please check your connection and try again.'
  return 'Unable to verify your account. Try again.'
}

const PW_RULES = [
  { id: 'len',     label: 'Minimum 8 characters',   test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter',   test: (p: string) => /[A-Z]/.test(p) },
  { id: 'num',     label: 'One number',             test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'One special character',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.82z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"/>
      <path fill="#EA4335" d="M12 4.76c1.76 0 3.35.6 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  )
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<'welcome' | 'confirm' | 'reset' | null>(null)
  // Resend cooldown (seconds) after a reset link is sent
  const [resendIn, setResendIn] = useState(0)
  const { signIn, signUp, signInWithProvider, forgotPassword } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const rulesPassed = PW_RULES.filter(r => r.test(password))
  const allRulesPass = rulesPassed.length === PW_RULES.length
  const strength = rulesPassed.length <= 1 ? 'Weak' : rulesPassed.length < 4 ? 'Medium' : 'Strong'
  const strengthColor = { Weak: '#ef4444', Medium: '#f59e0b', Strong: 'var(--accent)' }[strength]

  const fail = (msg: string) => {
    setError(friendlyError(msg))
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleSubmit = async () => {
    setError('')
    if (mode === 'forgot') {
      if (!email) return
      setLoading(true)
      const err = await forgotPassword(email)
      setLoading(false)
      if (err) { fail(err); return }
      setSuccess('reset')
      setResendIn(30)
      return
    }
    if (!email || !password) return
    if (mode === 'register') {
      if (!name.trim()) return
      if (!allRulesPass) { fail('password policy'); setError('Please meet all the password requirements.'); return }
    }
    setLoading(true)
    if (mode === 'login') {
      const err = await signIn(email, password)
      setLoading(false)
      if (err) fail(err)
      else navigate('/')
    } else {
      const { error: err, needsConfirmation } = await signUp(email, password, name.trim())
      setLoading(false)
      if (err) { fail(err); return }
      if (needsConfirmation) {
        setSuccess('confirm')
      } else {
        // Success flow (spec §10): brief welcome, then straight to Home
        setSuccess('welcome')
        setTimeout(() => navigate('/'), 1400)
      }
    }
  }

  const handleProvider = async (provider: 'google' | 'apple') => {
    setError('')
    const err = await signInWithProvider(provider)
    if (err) fail(err)
    // On success the browser redirects away; nothing else to do here.
  }

  const switchMode = (m: 'login' | 'register' | 'forgot') => {
    setMode(m); setError(''); setSuccess(null); setShowPw(false)
  }

  const disabled = loading || success !== null

  return (
    <div className="auth-page">
      {/* Standard mobile back action while resetting (login spec) */}
      {mode === 'forgot' && (
        <button
          type="button"
          aria-label="Back to sign in"
          onClick={() => switchMode('login')}
          style={{
            position: 'absolute', top: 'calc(12px + var(--safe-top))', left: 12, zIndex: 2,
            width: 44, height: 44, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-input)', border: 'none', cursor: 'pointer', color: 'var(--text-2)',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className={`auth-card ${shake ? 'auth-shake' : ''}`}>
        <div className="auth-logo">
          <img
            src="/brand.png"
            alt="Listo"
            style={{ width: 62, height: 62, display: 'block', margin: '0 auto 20px', boxShadow: '0 3px 10px rgba(0,0,0,0.25)', borderRadius: 16 }}
          />
          {mode === 'register' ? (
            <>
              <h1>Create your Listo account</h1>
              <p>Start organizing smarter together.</p>
            </>
          ) : mode === 'forgot' ? (
            // The heading tracks the screen's purpose: request → confirmation
            success === 'reset' ? (
              <h1>Check your inbox</h1>
            ) : (
              <>
                <h1>Reset your password</h1>
                <p>Enter your email and we'll send you a reset link.</p>
              </>
            )
          ) : (
            <>
              <h1>Welcome back</h1>
              <p>Sign in to continue with Listo.</p>
            </>
          )}
        </div>

        {success === 'welcome' ? (
          <div className="auth-success">
            <div className="check"><Check size={26} strokeWidth={2.5} /></div>
            <p style={{ fontWeight: 700, fontSize: 18 }}>Welcome to Listo!</p>
            <p className="text-sm text-muted" style={{ marginTop: 6 }}>Preparing your workspace…</p>
          </div>
        ) : success === 'confirm' ? (
          <div className="auth-success">
            <div className="check"><Check size={26} strokeWidth={2.5} /></div>
            <p style={{ fontWeight: 700, fontSize: 18 }}>Check your inbox</p>
            <p className="text-sm text-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Confirm your email, then sign in.
            </p>
            <button className="btn btn-secondary btn-full" style={{ marginTop: 20 }} onClick={() => switchMode('login')}>
              Go to Sign In
            </button>
          </div>
        ) : success === 'reset' ? (
          <div className="auth-success" style={{ padding: '4px 0 8px' }}>
            {/* Icon sits close to the page heading above — no repeated title */}
            <div className="check" style={{ marginBottom: 12 }}><Check size={26} strokeWidth={2.5} /></div>
            <p className="text-sm text-muted" style={{ lineHeight: 1.5 }}>
              We've sent a reset link to <strong>{email}</strong>.
            </p>
            <p className="text-sm" style={{ marginTop: 14, color: 'var(--text-3)' }}>
              Didn't get it?{' '}
              {resendIn > 0 ? (
                <span>Resend in {resendIn}s</span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const err = await forgotPassword(email)
                    if (err) { fail(err); return }
                    setResendIn(30)
                  }}
                  style={{
                    padding: '12px 4px', margin: '-12px -4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                  }}
                >
                  Resend link
                </button>
              )}
            </p>
            {error && <div className="error-msg" role="alert" style={{ marginTop: 14, textAlign: 'left' }}>{error}</div>}
            <button className="btn btn-secondary btn-full" style={{ marginTop: 20 }} onClick={() => switchMode('login')}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Real <form> so browsers and password managers offer to save /
                autofill credentials (login spec §autofill) */}
            <form className="auth-form" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
              {/* Social login first (spec §2) — not relevant while resetting */}
              {mode !== 'forgot' && (
                <>
                  <button type="button" className="auth-social" aria-label="Continue with Google" onClick={() => handleProvider('google')} disabled={disabled}>
                    <GoogleIcon /> Continue with Google
                  </button>
                  <button type="button" className="auth-social" aria-label="Continue with Apple" onClick={() => handleProvider('apple')} disabled={disabled}>
                    <AppleIcon /> Continue with Apple
                  </button>

                  <div className="auth-divider">OR</div>
                </>
              )}

              {error && <div className="error-msg" role="alert">{error}</div>}

              {mode === 'register' && (
                <div className="input-group">
                  <label className="input-label" htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    className="input"
                    placeholder="Enter your full name"
                    value={name}
                    autoComplete="name"
                    disabled={disabled}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="input-group">
                <label className="input-label" htmlFor="auth-email">Email Address</label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  enterKeyHint={mode === 'forgot' ? 'done' : 'next'}
                  placeholder="name@example.com"
                  value={email}
                  disabled={disabled}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    if (mode === 'forgot') { handleSubmit(); return }
                    // "Next" — move to the password field, don't submit yet
                    e.preventDefault()
                    document.getElementById('auth-password')?.focus()
                  }}
                />
              </div>

              {mode !== 'forgot' && (
              <div className="input-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="input-label" htmlFor="auth-password">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={{
                        // ≥44px tap target without inflating the label row
                        padding: '12px 0', margin: '-12px 0',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="auth-password"
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    placeholder={mode === 'register' ? 'Minimum 8 characters' : '••••••••'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    enterKeyHint="done"
                    value={password}
                    disabled={disabled}
                    style={{ paddingRight: 52 }}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                      width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-3)',
                    }}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Rules while typing; collapse to strength once all pass (spec §5–6) */}
                {mode === 'register' && password.length > 0 && (
                  allRulesPass ? (
                    <div className="pw-strength" style={{ color: strengthColor }}>
                      <div className="bar"><div style={{ width: '100%', background: strengthColor }} /></div>
                      Strong ✓
                    </div>
                  ) : (
                    <>
                      <div className="pw-strength" style={{ color: strengthColor }}>
                        <div className="bar">
                          <div style={{ width: `${(rulesPassed.length / PW_RULES.length) * 100}%`, background: strengthColor }} />
                        </div>
                        {strength}
                      </div>
                      <div className="pw-rules">
                        {PW_RULES.map(r => {
                          const ok = r.test(password)
                          return (
                            <span key={r.id} className={`pw-rule ${ok ? 'ok' : ''}`}>
                              <Check size={13} strokeWidth={3} style={{ opacity: ok ? 1 : 0.25 }} /> {r.label}
                            </span>
                          )
                        })}
                      </div>
                    </>
                  )
                )}
              </div>
              )}

              {mode === 'register' && (
                <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
                  By creating an account, you agree to our{' '}
                  <Link to="/terms" style={{ color: 'var(--accent)', fontWeight: 600 }}>Terms of Service</Link> and{' '}
                  <Link to="/privacy" style={{ color: 'var(--accent)', fontWeight: 600 }}>Privacy Policy</Link>
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={disabled || !email || (mode !== 'forgot' && !password) || (mode === 'register' && !name.trim())}
                style={{ marginTop: 8 }}
              >
                {loading
                  ? <><span className="spinner" style={{ marginRight: 8 }} />{mode === 'login' ? 'Signing In…' : mode === 'forgot' ? 'Sending…' : 'Creating Account…'}</>
                  : mode === 'login' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'}
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>Don't have an account? <a onClick={() => switchMode('register')}>Sign Up</a></>
              ) : mode === 'forgot' ? (
                <>Remembered it? <a onClick={() => switchMode('login')}>Sign In</a></>
              ) : (
                <>Already have an account? <a onClick={() => switchMode('login')}>Sign In</a></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
