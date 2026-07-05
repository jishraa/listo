import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import { PW_RULES, isPasswordValid } from '../lib/password'

// Password-recovery landing — the target of the email reset link. Supabase
// consumes the link's token into a recovery session on load; from there
// changePassword() (auth.updateUser) sets the new password.
export default function ResetPassword() {
  const navigate = useNavigate()
  const { changePassword } = useAuthStore()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // The recovery link may still be exchanging its token when we mount —
    // give it a moment before declaring the link dead.
    let cancelled = false
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) { setReady(true); return }
      setTimeout(async () => {
        const { data: { session: retry } } = await supabase.auth.getSession()
        if (cancelled) return
        if (retry) setReady(true)
        else setInvalid(true)
      }, 1500)
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!isPasswordValid(password)) { setError('Please meet all the password requirements.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setBusy(true)
    const err = await changePassword(password)
    setBusy(false)
    if (err) { setError(err.toLowerCase().includes('different') ? 'New password must be different from the old one.' : 'Could not update the password. Try requesting a new link.'); return }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1400)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/brand.png" alt="Listo" style={{ width: 64, height: 64, borderRadius: 16 }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', margin: '14px 0 6px' }}>Reset password</h1>

        {done ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <Check size={30} color="var(--accent)" strokeWidth={2.5} style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontWeight: 600 }}>Password updated</p>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>Taking you to your lists…</p>
          </div>
        ) : invalid ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
              This reset link is invalid or has expired.
              Request a new one from the sign-in screen.
            </p>
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => navigate('/login', { replace: true })}>
              Back to Sign In
            </button>
          </div>
        ) : !ready ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <span className="spinner" style={{ width: 26, height: 26, borderWidth: 3 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="text-sm" style={{ color: 'var(--text-2)', textAlign: 'center' }}>
              Choose a new password for your account.
            </p>
            <div className="input-group">
              <label className="input-label" htmlFor="new-password">New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  value={password}
                  style={{ paddingRight: 52 }}
                  onChange={e => setPassword(e.target.value)}
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
              {/* Same policy as sign-up (shared PW_RULES) */}
              {password && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
                  {PW_RULES.map(r => {
                    const ok = r.test(password)
                    return (
                      <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: ok ? 'var(--accent)' : 'var(--text-3)' }}>
                        {ok ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
                        {r.label}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="Re-enter the new password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            {error && <p className="error-msg" role="alert">{error}</p>}
            <button
              className="btn btn-primary btn-full"
              disabled={busy || !password || !confirm}
              onClick={handleSubmit}
            >
              {busy ? <><span className="spinner" style={{ marginRight: 8 }} />Updating…</> : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
