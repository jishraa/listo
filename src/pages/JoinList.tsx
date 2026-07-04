import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'

// Joining goes through the redeem_list_invite RPC (SECURITY DEFINER) via
// store.joinByCode — RLS blocks strangers from reading the lists table
// directly, so the invite can't be previewed before redeeming.
export default function JoinList() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, displayName, signInAsGuest } = useAuthStore()
  const joinByCode = useListsStore(s => s.joinByCode)

  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validCode = !!code && /^[a-z0-9]{6,12}$/.test(code)

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

    // Already a member (or the owner): don't strand them on an error —
    // members can read the list row, so resolve it and go straight there.
    if (res.message === 'Already joined' || res.message === 'You already own this list') {
      await useListsStore.getState().refreshLists()
      const known = useListsStore.getState().lists.find(l => l.invite_code === code)
      setLoading(false)
      navigate(known ? `/list/${known.id}` : '/', { replace: true })
      return
    }

    setLoading(false)
    setError(res.message)
  }

  if (!validCode) {
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

        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius)',
            padding: '18px 16px',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <Users size={26} style={{ color: 'var(--accent)' }} />
          <p style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>You've been invited</p>
          <p className="text-sm text-muted mt-2">
            Join the shared list to add items and check things off together.
          </p>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

        {user ? (
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
        ) : (
          <div className="auth-form">
            <p className="text-muted text-sm">Enter your name to join — no account needed.</p>
            <div className="input-group">
              <label className="input-label">Your name</label>
              <input
                className="input"
                placeholder="Jane Doe"
                value={nameInput}
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
        )}
      </div>
    </div>
  )
}
