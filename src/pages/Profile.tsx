import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Gift, KeyRound, LogOut, Mail, Monitor, Moon, Pencil, Sun, Tag, User, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import type { ThemePref } from '../store/useThemeStore'
import { useListsStore, visibleLists } from '../store/useListsStore'
import { DEFAULT_TYPE_KEY, getDefaultListType } from '../components/lists/CreateListSheet'
import Sheet from '../components/ui/Sheet'
import type { ListType } from '../types'

const THEME_OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

const LIST_TYPE_OPTIONS: { value: ListType; label: string; emoji: string }[] = [
  { value: 'personal', label: 'Personal', emoji: '📋' },
  { value: 'tasks',    label: 'Tasks',    emoji: '✅' },
  { value: 'shopping', label: 'Shopping', emoji: '🛒' },
]

// Invitation copy per the referral spec: short, friendly, collaboration-first.
const REFERRAL_MESSAGE =
  "I'm using Listo to organize my shopping and daily lists. It's simple, collaborative, and helps save time. Try it:"

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

function SettingsRow({ icon, label, value, onPress, last = false }: {
  icon?: React.ReactNode; label: string; value?: string; onPress?: () => void; last?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default',
        borderBottom: last ? 'none' : '1px solid var(--border)', textAlign: 'left',
      }}
    >
      {icon && <span style={{ color: 'var(--text-2)', display: 'flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: 'var(--text-3)', marginRight: onPress ? 4 : 0 }}>{value}</span>}
      {onPress && <ChevronRight size={16} color="var(--text-3)" />}
    </button>
  )
}

export default function Profile() {
  const { user, displayName, setDisplayName, signOut, isGuest, changePassword } = useAuthStore()
  const { pref, setPref } = useThemeStore()
  const lists = useListsStore(s => s.lists)
  const userId = useListsStore(s => s.userId)
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName)
  const [defaultType, setDefaultType] = useState<ListType>(getDefaultListType)
  const [pwOpen, setPwOpen]     = useState(false)
  const [pw, setPw]             = useState('')
  const [pwBusy, setPwBusy]     = useState(false)
  const [pwMsg, setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  const sharedCount = visibleLists(lists).filter(l => l.owner_id !== userId).length

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== displayName) setDisplayName(n)
    setEditingName(false)
  }

  const pickDefaultType = (t: ListType) => {
    setDefaultType(t)
    localStorage.setItem(DEFAULT_TYPE_KEY, t)
  }

  const handleChangePassword = async () => {
    if (pw.length < 8 || pwBusy) return
    setPwBusy(true)
    setPwMsg(null)
    const err = await changePassword(pw)
    setPwBusy(false)
    if (err) {
      setPwMsg({ ok: false, text: err.toLowerCase().includes('different') ? 'New password must differ from the old one.' : 'Could not update password. Try again.' })
    } else {
      setPwMsg({ ok: true, text: 'Password updated.' })
      setPw('')
      setTimeout(() => { setPwOpen(false); setPwMsg(null) }, 1200)
    }
  }

  const handleInvite = async () => {
    const url = window.location.origin
    if (navigator.share) {
      await navigator.share({ title: 'Listo', text: REFERRAL_MESSAGE, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${REFERRAL_MESSAGE} ${url}`).catch(() => {})
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="page">
      <div style={{ padding: '24px 16px 4px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Profile</h1>
      </div>

      <div className="page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Profile card */}
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
            <SettingsRow icon={<Mail size={16} />} label="Email" value={user?.email ?? '—'} />
          )}
          {!isGuest && (
            <SettingsRow icon={<KeyRound size={16} />} label="Password" value="Change"
              onPress={() => { setPw(''); setPwMsg(null); setPwOpen(true) }} last />
          )}
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Appearance</p>
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
          <SettingsRow icon={<Tag size={16} />} label="Manage Categories" onPress={() => navigate('/categories')} />
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Default List Type</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {LIST_TYPE_OPTIONS.map(({ value, label, emoji }) => {
                const active = defaultType === value
                return (
                  <button
                    key={value}
                    onClick={() => pickDefaultType(value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 6, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                      background: active ? 'var(--accent-dim)' : 'var(--bg-input)',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      transition: 'all 0.18s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </SettingsSection>

        {/* Collaboration */}
        <SettingsSection title="Collaboration">
          <SettingsRow
            icon={<Users size={16} />}
            label="Shared with me"
            value={sharedCount > 0 ? String(sharedCount) : 'None yet'}
            onPress={sharedCount > 0 ? () => navigate('/?filter=shared') : undefined}
            last
          />
        </SettingsSection>

        {/* Refer Friends */}
        <button
          onClick={handleInvite}
          className="card"
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(22,163,74,0.14) 0%, var(--bg-card) 70%)',
            borderColor: 'var(--border-2)',
          }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'var(--accent-dim)', border: '1px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Gift size={20} color="var(--accent)" />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15 }}>Invite Friends</p>
              <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 2 }}>Planning is better together.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 12 }}>
            {['Shop together', 'Real-time updates', 'Shared lists'].map(b => (
              <span key={b} className="text-xs" style={{ color: 'var(--text-2)' }}>✓ {b}</span>
            ))}
          </div>
          <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>
            Invite Friends
          </span>
        </button>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow label="Version" value="1.0.0" />
          <SettingsRow label="Privacy Policy" onPress={() => navigate('/privacy')} />
          <SettingsRow label="Terms of Service" onPress={() => navigate('/terms')} />
          <SettingsRow label="Send Feedback" onPress={() => { window.location.href = 'mailto:grk766@gmail.com?subject=Listo%20Feedback' }} last />
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

      {/* Change password sheet */}
      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <div className="sheet-body">
          <p className="text-sm text-muted">Minimum 8 characters.</p>
          <input
            className="input"
            type="password"
            placeholder="New password"
            value={pw}
            autoComplete="new-password"
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
            autoFocus
          />
          {pwMsg && (
            <p className="text-sm" style={{ color: pwMsg.ok ? 'var(--accent)' : '#f87171', fontWeight: 600 }}>
              {pwMsg.text}
            </p>
          )}
          <button className="btn btn-primary btn-full" onClick={handleChangePassword} disabled={pw.length < 8 || pwBusy}>
            {pwBusy ? <span className="spinner" /> : 'Update Password'}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
