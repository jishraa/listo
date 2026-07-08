import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Gift, HelpCircle, LogOut, Settings2, Tag, User, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { useCategoriesStore } from '../store/useCategoriesStore'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { openYft } from '../lib/yft'
import { Section, Row } from './profile/common'
import { APP_VERSION } from '../lib/version'

const THEME_LABEL: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export default function Profile() {
  const { user, displayName, signOut, isGuest } = useAuthStore()
  const themePref = useThemeStore(s => s.pref)
  const categories = useCategoriesStore(s => s.categories)
  const categoryCount = Object.values(categories).flat().length
  const navigate = useNavigate()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  // Guest → account: signing up ends the anonymous session, so joined lists
  // don't carry over. Never do that silently — confirm with the consequences.
  const [confirmUpgrade, setConfirmUpgrade] = useState(false)

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  // Identity block — avatar left, name / email / member since right.
  const identity = (
    <>
      <div style={{
        width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent) 0%, #14B8A6 100%)',
        border: '2px solid var(--border-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(22,163,74,0.25)',
      }}>
        {displayName
          ? <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{initials}</span>
          : <User size={26} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || 'Guest'}</p>
        {!isGuest && <p className="text-sm text-muted" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>}
        {isGuest && <span className="badge badge-gray" style={{ marginTop: 6, display: 'inline-block' }}>Guest</span>}
        {memberSince && (
          <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 4 }}>
            Member since {memberSince}
          </p>
        )}
      </div>
    </>
  )

  return (
    // Tab page (renders inside AppShell, bottom nav below) — no back header.
    <div className="page">
      <div style={{ padding: '20px 16px 4px' }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.4px', margin: 0 }}>Profile</h1>
      </div>
      <div className="page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Profile card — the whole card is tappable → account (members only) */}
        {isGuest ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {identity}
          </div>
        ) : (
          <button
            className="card card-press"
            onClick={() => navigate('/profile/account')}
            aria-label="Manage account"
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: 16, textAlign: 'left', cursor: 'pointer',
            }}
          >
            {identity}
            <ChevronRight size={18} color="var(--text-3)" style={{ flexShrink: 0 }} />
          </button>
        )}

        {/* Guest upgrade prompt */}
        {isGuest && (
          <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-2)' }}>
            <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 4 }}>
              You're browsing as a guest
            </p>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
              Create an account to make your own lists and use Listo across devices.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setConfirmUpgrade(true)}>
              Create Account
            </button>
          </div>
        )}

        {/* Account is reached via the card's "Manage Account →" link, so there's
            no duplicate ACCOUNT row. Guests use the upgrade prompt above. */}
        <Section title="App">
          <Row icon={<Settings2 size={17} />} label="Preferences" value={THEME_LABEL[themePref]} onPress={() => navigate('/profile/preferences')} />
          <Row icon={<Tag size={17} />} label="Manage Categories" value={`${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`} onPress={() => navigate('/categories')} last />
        </Section>

        <Section title="Collaboration">
          <Row icon={<Users size={17} />} label="Collaboration" onPress={() => navigate('/profile/collaboration')} last />
        </Section>

        <Section title="Community">
          <Row icon={<Gift size={17} />} label="Invite Friends" onPress={() => navigate('/profile/invite')} />
          <Row icon={<HelpCircle size={17} />} label="Help & Support" onPress={() => navigate('/profile/help')} last />
        </Section>

        {/* Companion apps (YFT integration spec §6 / Our Apps §10) */}
        <Section title="Our Apps">
          <Row
            icon={<img src="/yft.png" alt="" aria-hidden style={{ width: 26, height: 26, borderRadius: 7 }} />}
            label="YFT"
            subtitle="Personal Finance Tracker"
            value="Learn More"
            valueColor="var(--accent-text)"
            onPress={() => openYft('/about')}
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

        {/* Subtle footer (spec §16) */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>Listo</p>
          <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 2 }}>Version {APP_VERSION} · Made with 💚</p>
        </div>

      {/* Guest → account confirmation: make the trade-off explicit */}
      <ConfirmSheet
        open={confirmUpgrade}
        onClose={() => setConfirmUpgrade(false)}
        title="Create your account"
        confirmLabel="Continue"
        danger={false}
        onConfirm={async () => { await signOut(); navigate('/login?mode=register') }}
      >
        Your guest session on this device will end. Lists you joined as a guest
        won't carry over — you can rejoin them anytime with their invite links.
      </ConfirmSheet>

      {/* Sign out confirmation */}
      <ConfirmSheet
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        icon={<LogOut size={30} color="#ef4444" />}
        title={isGuest ? 'Leave guest session?' : 'Sign out?'}
        confirmLabel={isGuest ? 'Leave' : 'Sign Out'}
        onConfirm={handleSignOut}
      >
        {isGuest
          ? 'Your guest session will be cleared on this device.'
          : "You'll need to sign in again to access your lists."}
      </ConfirmSheet>
      </div>
    </div>
  )
}
