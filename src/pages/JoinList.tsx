import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ListChecks, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore } from '../store/useListsStore'
import type { List } from '../types'

export default function JoinList() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, displayName, signInAsGuest } = useAuthStore()
  const { getListByInviteCode, joinList } = useListsStore()

  const [list, setList] = useState<List | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(true)

  useEffect(() => {
    const resolve = async () => {
      if (!code || !/^[a-z0-9]{6,12}$/.test(code)) {
        setError('Invalid invite link.')
        setResolving(false)
        return
      }
      const found = await getListByInviteCode(code)
      if (!found) {
        setError('This invite link is invalid or has expired.')
      } else {
        setList(found)
      }
      setResolving(false)
    }
    resolve()
  }, [code])

  const handleJoin = async () => {
    if (!list) return
    setError('')
    const name = user ? displayName : nameInput.trim()
    if (!name) { setError('Please enter your name.'); return }
    setLoading(true)

    if (!user) {
      const err = await signInAsGuest(nameInput.trim())
      if (err) { setError(err); setLoading(false); return }
    }

    const { user: freshUser } = useAuthStore.getState()
    if (!freshUser) { setError('Could not create guest session.'); setLoading(false); return }

    const err = await joinList(list.id, freshUser.id, name)
    if (err) { setError(err); setLoading(false); return }

    navigate(`/list/${list.id}`)
  }

  if (resolving) {
    return (
      <div className="auth-page">
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  if (error && !list) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Link not found</h2>
          <p className="text-muted text-sm mt-2">{error}</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <ListChecks size={28} />
          </div>
          <h1>Listo</h1>
        </div>

        {list && (
          <div
            style={{
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36 }}>{list.emoji}</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{list.name}</p>
            <p className="text-sm text-muted mt-2">
              <Users size={13} style={{ display: 'inline', marginRight: 4 }} />
              You've been invited to collaborate
            </p>
          </div>
        )}

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
              {loading ? <span className="spinner" /> : `Join "${list?.name}"`}
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
