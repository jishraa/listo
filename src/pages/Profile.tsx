import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, CheckCircle2, ChevronRight, ClipboardList, Cloud, FileText, Gift, History, Info,
  KeyRound, Link2, ListChecks, LogOut, Mail, MessageSquare, Monitor, Moon, Palette,
  Share2, Shield, Sun, Tag, User, Users,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import type { ThemePref } from '../store/useThemeStore'
import { useListsStore, visibleLists } from '../store/useListsStore'
import { DEFAULT_TYPE_KEY, getDefaultListType } from '../components/lists/CreateListSheet'
import Sheet from '../components/ui/Sheet'
import { formatRelativeTime } from '../lib/utils'
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

const REFERRAL_MESSAGE =
  "I'm using Listo to organize my shopping and daily lists. It's simple, collaborative, and helps save time. Try it:"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function Row({ icon, label, value, valueColor, onPress, last = false }: {
  icon: React.ReactNode; label: string; value?: string; valueColor?: string
  onPress?: () => void; last?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 50,
        padding: '13px 16px', background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default',
        borderBottom: last ? 'none' : '1px solid var(--border)', textAlign: 'left',
      }}
    >
      <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
      {value && (
        <span style={{
          fontSize: 14, color: valueColor ?? 'var(--text-3)', fontWeight: valueColor ? 600 : 400,
          marginRight: onPress ? 4 : 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</span>
      )}
      {onPress && <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />}
    </button>
  )
}

export default function Profile() {
  const { user, displayName, setDisplayName, signOut, isGuest, changePassword } = useAuthStore()
  const { pref, setPref } = useThemeStore()
  const lists = useListsStore(s => s.lists)
  const itemsMap = useListsStore(s => s.items)
  const membersMap = useListsStore(s => s.members)
  const userId = useListsStore(s => s.userId)
  const navigate = useNavigate()

  const [activeSheet, setActiveSheet] = useState<'name' | 'appearance' | 'listType' | 'password' | 'signout' | null>(null)
  const [nameInput, setNameInput] = useState(displayName)
  const [defaultType, setDefaultType] = useState<ListType>(getDefaultListType)
  const [pw, setPw]         = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // ── Real stats ────────────────────────────────────────────────
  const visible = visibleLists(lists)
  const listCount = visible.length
  const sharedWithMe = visible.filter(l => l.owner_id !== userId).length
  const mySharedLists = visible.filter(l => l.owner_id === userId && (membersMap[l.id] ?? []).length > 1).length
  const completedItems = visible.reduce((n, l) => n + (itemsMap[l.id] ?? []).filter(i => i.completed).length, 0)
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null
  const lastActivity = visible.length > 0
    ? visible.reduce((max, l) => l.updated_at > max ? l.updated_at : max, visible[0].updated_at)
    : null
  const connectedProviders = [...new Set(
    (user?.identities ?? []).map(i => i.provider === 'email' ? 'Email' : i.provider.charAt(0).toUpperCase() + i.provider.slice(1))
  )].join(', ')

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== displayName) setDisplayName(n)
    setActiveSheet(null)
  }

  const pickDefaultType = (t: ListType) => {
    setDefaultType(t)
    localStorage.setItem(DEFAULT_TYPE_KEY, t)
    setActiveSheet(null)
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
      setTimeout(() => { setActiveSheet(null); setPwMsg(null) }, 1200)
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
  const themeLabel = THEME_OPTIONS.find(o => o.value === pref)?.label ?? 'System'
  const typeLabel = LIST_TYPE_OPTIONS.find(o => o.value === defaultType)?.label ?? 'Personal'

  return (
    <div className="page">
      <div style={{ padding: '24px 16px 4px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Profile</h1>
      </div>

      <div className="page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Profile card ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ textAlign: 'center', padding: '26px 20px 20px' }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'var(--accent-dim)', border: '2px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
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
          {/* Quick stats */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
            {[
              { icon: <ListChecks size={15} />, value: String(listCount), label: listCount === 1 ? 'List' : 'Lists' },
              { icon: <Users size={15} />,      value: String(sharedWithMe), label: 'Shared with me' },
              ...(memberSince ? [{ icon: <History size={15} />, value: memberSince, label: 'Member since' }] : []),
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                flex: 1, padding: '12px 6px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div className="flex items-center justify-center" style={{ gap: 5, color: 'var(--accent)' }}>
                  {s.icon}
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.value}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{s.label}</p>
              </div>
            ))}
          </div>
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

        {/* ── Account ── */}
        <Section title="Account">
          <Row icon={<User size={17} />} label="Display Name" value={displayName || '—'}
            onPress={() => { setNameInput(displayName); setActiveSheet('name') }} />
          {!isGuest && <Row icon={<Mail size={17} />} label="Email" value={user?.email ?? '—'} />}
          {!isGuest && (
            <Row icon={<KeyRound size={17} />} label="Password" value="Change"
              onPress={() => { setPw(''); setPwMsg(null); setActiveSheet('password') }} />
          )}
          {!isGuest && connectedProviders && (
            <Row icon={<Link2 size={17} />} label="Connected Accounts" value={connectedProviders} last />
          )}
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <Row icon={<Palette size={17} />} label="Appearance" value={themeLabel}
            onPress={() => setActiveSheet('appearance')} />
          <Row icon={<ClipboardList size={17} />} label="Default List Type" value={typeLabel}
            onPress={() => setActiveSheet('listType')} />
          <Row icon={<Tag size={17} />} label="Manage Categories"
            onPress={() => navigate('/categories')} last />
        </Section>

        {/* ── Collaboration ── */}
        <Section title="Collaboration">
          <Row icon={<Users size={17} />} label="Shared with me"
            value={sharedWithMe > 0 ? `${sharedWithMe} ${sharedWithMe === 1 ? 'list' : 'lists'}` : 'None yet'}
            onPress={sharedWithMe > 0 ? () => navigate('/?filter=shared') : undefined} />
          <Row icon={<Share2 size={17} />} label="My shared lists"
            value={mySharedLists > 0 ? `${mySharedLists} ${mySharedLists === 1 ? 'list' : 'lists'}` : 'None yet'} last />
        </Section>

        {/* ── Cloud & Sync ── */}
        <Section title="Cloud & Sync">
          <Row icon={<Cloud size={17} />} label="Cloud Sync" value="Enabled" valueColor="var(--accent)" />
          <Row icon={<History size={17} />} label="Last activity"
            value={lastActivity ? formatRelativeTime(lastActivity) : '—'} last />
        </Section>

        {/* ── Stats ── */}
        <Section title="Stats & Insights">
          <Row icon={<CheckCircle2 size={17} />} label="Items completed" value={String(completedItems)} last />
        </Section>

        {/* ── Refer & Earn ── */}
        <button
          onClick={handleInvite}
          className="card referral-card"
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(22,163,74,0.14) 0%, var(--bg-card) 70%)',
            borderColor: 'var(--border-2)',
          }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Gift size={20} color="#fff" />
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
            <Share2 size={14} /> Invite Friends
          </span>
        </button>

        {/* ── About ── */}
        <Section title="About">
          <Row icon={<Info size={17} />} label="Version" value="1.0.0" />
          <Row icon={<Shield size={17} />} label="Privacy Policy" onPress={() => navigate('/privacy')} />
          <Row icon={<FileText size={17} />} label="Terms of Service" onPress={() => navigate('/terms')} />
          <Row icon={<MessageSquare size={17} />} label="Send Feedback"
            onPress={() => { window.location.href = 'mailto:grk766@gmail.com?subject=Listo%20Feedback' }} last />
        </Section>

        {/* ── Sign out — outlined red, with confirmation ── */}
        <button
          onClick={() => setActiveSheet('signout')}
          className="btn btn-full"
          style={{
            justifyContent: 'center', gap: 10,
            background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
            color: '#ef4444', fontWeight: 700,
          }}
        >
          <LogOut size={17} />
          {isGuest ? 'Leave (clear session)' : 'Sign Out'}
        </button>

        <p className="text-sm" style={{ color: 'var(--text-3)', textAlign: 'center', paddingBottom: 8 }}>
          Thank you for using Listo! 💚
        </p>
      </div>

      {/* ── Display name sheet ── */}
      <Sheet open={activeSheet === 'name'} onClose={() => setActiveSheet(null)} title="Display Name">
        <div className="sheet-body">
          <input
            className="input"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            maxLength={50}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveSheet(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveName} disabled={!nameInput.trim()}>Save</button>
          </div>
        </div>
      </Sheet>

      {/* ── Appearance sheet ── */}
      <Sheet open={activeSheet === 'appearance'} onClose={() => setActiveSheet(null)} title="Appearance">
        <div className="sheet-body" style={{ gap: 8 }}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              className="btn btn-secondary btn-full"
              style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={() => { setPref(value); setActiveSheet(null) }}
            >
              <Icon size={17} />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {pref === value && <Check size={16} color="var(--accent)" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* ── Default list type sheet ── */}
      <Sheet open={activeSheet === 'listType'} onClose={() => setActiveSheet(null)} title="Default List Type">
        <div className="sheet-body" style={{ gap: 8 }}>
          {LIST_TYPE_OPTIONS.map(({ value, label, emoji }) => (
            <button
              key={value}
              className="btn btn-secondary btn-full"
              style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={() => pickDefaultType(value)}
            >
              <span style={{ fontSize: 17 }}>{emoji}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {defaultType === value && <Check size={16} color="var(--accent)" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* ── Change password sheet ── */}
      <Sheet open={activeSheet === 'password'} onClose={() => setActiveSheet(null)} title="Change Password">
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

      {/* ── Sign out confirmation ── */}
      <Sheet open={activeSheet === 'signout'} onClose={() => setActiveSheet(null)}>
        <div className="sheet-body" style={{ textAlign: 'center' }}>
          <LogOut size={30} color="#ef4444" style={{ margin: '4px auto 10px' }} />
          <p style={{ fontWeight: 700, fontSize: 17 }}>
            {isGuest ? 'Leave guest session?' : 'Sign out?'}
          </p>
          <p className="text-muted text-sm mt-2">
            {isGuest
              ? 'Your guest session will be cleared on this device.'
              : "You'll need to sign in again to access your lists."}
          </p>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveSheet(null)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleSignOut}>
              {isGuest ? 'Leave' : 'Sign Out'}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
