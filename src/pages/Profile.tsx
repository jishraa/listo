import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Monitor, Moon, Sun, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import type { ThemePref } from '../store/useThemeStore'

const THEME_OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export default function Profile() {
  const { user, displayName, signOut, isGuest } = useAuthStore()
  const { pref, setPref } = useThemeStore()
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

      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Avatar card */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--accent-dim)',
            border: '1.5px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: 'var(--accent-glow)',
          }}>
            <User size={28} color="var(--accent)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{displayName || 'Guest'}</p>
          {!isGuest && <p className="text-sm text-muted" style={{ marginTop: 4 }}>{user?.email}</p>}
          {isGuest && <span className="badge badge-gray" style={{ marginTop: 8 }}>Guest</span>}
        </div>

        {/* Guest upgrade prompt */}
        {isGuest && (
          <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-2)' }}>
            <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>
              You're browsing as a guest
            </p>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
              Create an account to own lists and access them across devices.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { signOut(); navigate('/login') }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Appearance */}
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Appearance
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = pref === value
              return (
                <button
                  key={value}
                  onClick={() => setPref(value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                    background: active ? 'var(--accent-dim)' : 'var(--bg-input)',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    boxShadow: active ? 'var(--accent-glow)' : 'none',
                    transition: 'all 0.18s',
                  }}
                >
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: '0.01em' }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sign out */}
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
