import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import { friendlyName } from '../lib/utils'
import type { InvitePreview } from '../types'

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

// Shared-link join flow: preview the invite (safe, non-secret RPC), then let
// the visitor pick how to enter — Google / account / guest. Guest is
// only offered here, never on the normal Login screen.
export default function JoinList() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, displayName, signInAsGuest, signInWithProvider } = useAuthStore()
  const { joinByCode, getInvitePreview } = useListsStore()

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [phase, setPhase] = useState<'choices' | 'guest'>('choices')
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validCode = !!code && /^[a-z0-9]{6,12}$/.test(code)

  // Fetch the preview once for a well-formed code.
  useEffect(() => {
    if (!validCode || !code) { setPreviewLoading(false); return }
    let cancelled = false
    getInvitePreview(code)
      .then(p => { if (!cancelled) { setPreview(p); setPreviewLoading(false) } })
      .catch(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const handleJoin = async () => {
    if (!code || loading) return
    setError('')
    const name = user ? (displayName || user.email?.split('@')[0] || 'User') : nameInput.trim()
    if (!name) { setError('Please enter your name.'); return }
    setLoading(true)

    if (!user) {
      const err = await signInAsGuest(nameInput.trim())
      if (err) { setError('Could not start a guest session — try again.'); setLoading(false); return }
    }

    const { user: freshUser } = useAuthStore.getState()
    if (!freshUser) { setError('Could not start a session — try again.'); setLoading(false); return }

    // joinByCode reads identity from the lists store — make sure it's set
    // even when the store hasn't been initialized yet (fresh guest).
    useListsStore.setState({ userId: freshUser.id, displayName: name })

    const res = await joinByCode(code)
    if (res.success && res.list) {
      setLoading(false)
      navigate(`/list/${res.list.id}`, { replace: true })
      return
    }

    // Already a member (or the owner): don't strand them on an error — resolve
    // the code to its list id (server-side, only works because they're already
    // in the list) and go straight there.
    if (res.message === 'Already joined' || res.message === 'You already own this list') {
      const knownId = await useListsStore.getState().resolveListIdByCode(code)
      await useListsStore.getState().refreshLists()
      setLoading(false)
      navigate(knownId ? `/list/${knownId}` : '/', { replace: true })
      return
    }

    setLoading(false)
    setError(res.message)
  }

  const handleProvider = async (provider: 'google' | 'apple') => {
    setError('')
    // Return straight back to this invite after the OAuth round-trip so the
    // join resumes with a real session.
    const err = await signInWithProvider(provider, `${window.location.origin}/join/${code}`)
    if (err) setError(err)
  }

  // Invalid format, or a valid-looking code that resolved to nothing.
  if (!validCode || (!previewLoading && !preview)) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Link not found</h2>
          <p className="text-muted text-sm mt-2">This invite link is invalid or has expired.</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/brand.png"
            alt="Listo"
            style={{ width: 76, height: 76, display: 'block', margin: '0 auto', boxShadow: '0 6px 22px rgba(22,163,74,0.25)', borderRadius: 18 }}
          />
        </div>

        {/* Invite preview */}
        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius)',
            padding: '18px 16px',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          {previewLoading || !preview ? (
            <div style={{ padding: '8px 0' }}>
              <Users size={26} style={{ color: 'var(--accent)' }} />
              <p className="text-sm text-muted mt-2">Loading invite…</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 34, lineHeight: 1 }}>{preview.emoji || '📝'}</div>
              <p className="text-sm text-muted" style={{ marginTop: 10 }}>You've been invited to join</p>
              <p style={{ fontWeight: 700, fontSize: 18, marginTop: 2 }}>{preview.name}</p>
              <p className="text-sm text-muted mt-2">
                by {friendlyName(preview.ownerName)}
                {preview.memberCount > 0 && ` · ${preview.memberCount} ${preview.memberCount === 1 ? 'member' : 'members'}`}
              </p>
            </>
          )}
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

        {user ? (
          /* Already signed in (incl. returning from an OAuth redirect) */
          <div>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              Joining as <strong>{displayName || user.email}</strong>
            </p>
            <button
              className="btn btn-primary btn-full"
              onClick={handleJoin}
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <span className="spinner" /> : 'Join List'}
            </button>
          </div>
        ) : phase === 'guest' ? (
          /* Guest → enter a display name → join */
          <div className="auth-form">
            <button
              type="button"
              onClick={() => { setPhase('choices'); setError('') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 4 }}
            >
              <ChevronLeft size={16} /> Other ways to join
            </button>
            <p className="text-muted text-sm">Continue as a guest — no account needed.</p>
            <div className="input-group">
              <label className="input-label">Your name</label>
              <input
                className="input"
                placeholder="Jane Doe"
                value={nameInput}
                maxLength={50}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleJoin}
              disabled={loading || !nameInput.trim()}
              style={{ opacity: loading || !nameInput.trim() ? 0.6 : 1 }}
            >
              {loading ? <span className="spinner" /> : 'Join List'}
            </button>
          </div>
        ) : (
          /* Authentication choice */
          <div className="auth-form">
            <button type="button" className="auth-social" aria-label="Continue with Google" onClick={() => handleProvider('google')} disabled={loading}>
              <GoogleIcon /> Continue with Google
            </button>
            {/* Apple sign-in disabled 2026-07 (user request). NOTE: App Store
                guideline 4.8 requires Apple wherever other social logins are
                offered — restore it before an iOS release. */}
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => navigate(`/login?next=${encodeURIComponent(`/join/${code}`)}`)}
              disabled={loading}
            >
              Sign In or Create Account
            </button>

            <div className="auth-divider">OR</div>

            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => setPhase('guest')}
              disabled={loading}
            >
              Continue as Guest
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
