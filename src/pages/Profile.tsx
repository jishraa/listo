import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Gift, Heart, Info, LogOut, Settings2, User, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import Sheet from '../components/ui/Sheet'
import { openYft } from '../lib/yft'
import { SubPage, Section, Row } from './profile/common'

// Profile hub — grouped so related actions live together and single-row
// sections are avoided (Support Listo sits with Invite under Community).
const NAV_GROUPS: { title?: string; items: { path: string; label: string; Icon: typeof User }[] }[] = [
  { title: 'Account', items: [
    { path: '/profile/account', label: 'Account', Icon: User },
  ]},
  { title: 'App', items: [
    { path: '/profile/preferences',   label: 'Preferences',   Icon: Settings2 },
    { path: '/profile/collaboration', label: 'Collaboration', Icon: Users },
    { path: '/profile/insights',      label: 'Insights',      Icon: BarChart2 },
  ]},
  { title: 'Community', items: [
    { path: '/profile/invite',  label: 'Invite Friends', Icon: Gift },
    { path: '/profile/support', label: 'Support Listo',  Icon: Heart },
  ]},
  { title: 'About', items: [
    { path: '/profile/about', label: 'About', Icon: Info },
  ]},
]

export default function Profile() {
  const { user, displayName, signOut, isGuest } = useAuthStore()
  const navigate = useNavigate()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <SubPage title="Profile">
      <>
        {/* Profile card — identity only, stats live in Insights */}
        <div className="card" style={{ textAlign: 'center', padding: '26px 20px' }}>
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
          {memberSince && (
            <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 6 }}>
              Member since {memberSince}
            </p>
          )}
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

        {/* Grouped navigation */}
        {NAV_GROUPS.map(group => (
          <Section key={group.title} title={group.title}>
            {group.items.map(({ path, label, Icon }, i) => (
              <Row
                key={path}
                icon={<Icon size={17} />}
                label={label}
                onPress={() => navigate(path)}
                last={i === group.items.length - 1}
              />
            ))}
          </Section>
        ))}

        {/* Companion apps (YFT integration spec §6) */}
        <Section title="Apps">
          <Row
            icon={<img src="/yft.png" alt="YFT" style={{ width: 24, height: 24, borderRadius: 6 }} />}
            label="YFT"
            value="Track Expenses"
            onPress={() => openYft('')}
            last
          />
        </Section>

        {/* Sign out — isolated, outlined red, confirmed */}
        <button
          onClick={() => setConfirmSignOut(true)}
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

      {/* Sign out confirmation */}
      <Sheet open={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
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
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmSignOut(false)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleSignOut}>
              {isGuest ? 'Leave' : 'Sign Out'}
            </button>
          </div>
        </div>
      </Sheet>
      </>
    </SubPage>
  )
}
