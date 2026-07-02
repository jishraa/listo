import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

export default function Profile() {
  const { user, displayName, signOut, isGuest } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <span className="header-title">Profile</span>
      </div>

      <div className="page page-padded">
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <User size={28} color="var(--accent)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{displayName || 'Guest'}</p>
          {!isGuest && <p className="text-sm text-muted" style={{ marginTop: 4 }}>{user?.email}</p>}
          {isGuest && (
            <span className="badge badge-gray" style={{ marginTop: 8 }}>Guest</span>
          )}
        </div>

        {isGuest && (
          <div className="card" style={{ marginBottom: 16, background: 'var(--accent-light)', border: 'none' }}>
            <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>
              You're browsing as a guest
            </p>
            <p className="text-sm" style={{ color: 'var(--accent)', opacity: 0.8 }}>
              Create an account to own lists and access them across devices.
            </p>
            <button
              className="btn btn-primary btn-sm mt-2"
              onClick={() => { signOut(); navigate('/login') }}
            >
              Create Account
            </button>
          </div>
        )}

        <button
          className="btn btn-danger btn-full"
          onClick={handleSignOut}
          style={{ justifyContent: 'flex-start', gap: 12 }}
        >
          <LogOut size={18} />
          {isGuest ? 'Leave (clear session)' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
