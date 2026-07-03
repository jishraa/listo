import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, LogOut, Monitor, Moon, Pencil, Sun, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import type { ThemePref } from '../store/useThemeStore'

const THEME_OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px 8px' }}>
        {title}
      </p>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function SettingsRow({ label, value, onPress, last = false }: { label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        padding: '14px 16px', background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default',
        borderBottom: last ? 'none' : '1px solid var(--border)', textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: 'var(--text-3)', marginRight: onPress ? 4 : 0 }}>{value}</span>}
      {onPress && <ChevronRight size={16} color="var(--text-3)" />}
    </button>
  )
}

export default function Profile() {
  const { user, displayName, setDisplayName, signOut, isGuest } = useAuthStore()
  const { pref, setPref } = useThemeStore()
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName)

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== displayName) setDisplayName(n)
    setEditingName(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <span className="header-title">Settings</span>
      </div>

      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar card */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '2px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: 'var(--accent-glow)',
          }}>
            {displayName ? (
              <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{initials}</span>
            ) : (
              <User size={28} color="var(--accent)" />
            )}
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
            <button className="btn btn-primary btn-sm" onClick={() => { signOut(); navigate('/login') }}>
              Create Account
            </button>
          </div>
        )}

        {/* Account */}
        <SettingsSection title="Account">
          {/* Display name row */}
          {editingName ? (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display Name</label>
              <input
                className="input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                autoFocus
              />
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingName(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveName} disabled={!nameInput.trim()}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>Display Name</span>
              <span style={{ fontSize: 14, color: 'var(--text-3)', marginRight: 8 }}>{displayName || '—'}</span>
              <button onClick={() => { setNameInput(displayName); setEditingName(true) }}
                style={{ background: 'var(--bg-input)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-2)' }}>
                <Pencil size={14} />
              </button>
            </div>
          )}
          {!isGuest && (
            <SettingsRow label="Email" value={user?.email ?? '—'} last />
          )}
        </SettingsSection>

        {/* Settings */}
        <SettingsSection title="Settings">
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
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
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow label="Version" value="1.0.0" last />
        </SettingsSection>

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
