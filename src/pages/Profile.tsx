import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Gift, Heart, Info, LogOut, Settings2, Tag, User, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useListsStore, visibleLists } from '../store/useListsStore'
import { useThemeStore } from '../store/useThemeStore'
import { useCategoriesStore } from '../store/useCategoriesStore'
import Sheet from '../components/ui/Sheet'
import { openYft } from '../lib/yft'
import { SubPage, Section, Row } from './profile/common'

const APP_VERSION = '1.3.0'
const THEME_LABEL: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export default function Profile() {
  const { user, displayName, signOut, isGuest } = useAuthStore()
  const lists = useListsStore(s => s.lists)
  const items = useListsStore(s => s.items)
  const members = useListsStore(s => s.members)
  const themePref = useThemeStore(s => s.pref)
  const categories = useCategoriesStore(s => s.categories)
  const categoryCount = Object.values(categories).flat().length
  const navigate = useNavigate()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  // Lightweight, dynamic account stats (spec §1/§14) — kept to three.
  const visible = visibleLists(lists)
  const listCount = visible.length
  const itemCount = visible.reduce((n, l) => n + (items[l.id]?.length ?? 0), 0)
  const sharedCount = visible.filter(l => (members[l.id]?.length ?? 0) > 1).length

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <SubPage title="Profile">
      <>
        {/* Profile card — identity + a few lightweight stats */}
        <div className="card" style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, #14B8A6 100%)',
            border: '2px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', boxShadow: '0 2px 10px rgba(22,163,74,0.25)',
          }}>
            {displayName
              ? <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{initials}</span>
              : <User size={28} color="#fff" />}
          </div>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{displayName || 'Guest'}</p>
          {!isGuest && <p className="text-sm text-muted" style={{ marginTop: 4, wordBreak: 'break-word' }}>{user?.email}</p>}
          {isGuest && <span className="badge badge-gray" style={{ marginTop: 8 }}>Guest</span>}
          {memberSince && (
            <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 6 }}>
              Member since {memberSince}
            </p>
          )}

          {!isGuest && (
            <>
              <div style={{
                display: 'flex', alignItems: 'stretch', marginTop: 16, paddingTop: 16,
                borderTop: '1px solid var(--border)',
              }}>
                {[
                  { n: listCount, label: listCount === 1 ? 'List' : 'Lists' },
                  { n: itemCount, label: itemCount === 1 ? 'Item' : 'Items' },
                  { n: sharedCount, label: 'Shared' },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                    borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{s.n}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</span>
                  </div>
                ))}
              </div>
              {/* Subtle, lower-emphasis account action (spec §2) */}
              <button
                onClick={() => navigate('/profile/account')}
                style={{
                  marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent-text)', fontSize: 13.5, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '8px 6px',
                }}
              >
                Manage Account <ChevronRight size={15} />
              </button>
            </>
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
          <Row icon={<Gift size={17} />} label="Invite Friends" onPress={() => navigate('/profile/invite')} last />
        </Section>

        <Section title="Help & Support">
          <Row icon={<Heart size={17} />} label="Support Listo" onPress={() => navigate('/profile/support')} />
          <Row icon={<Info size={17} />} label="About" onPress={() => navigate('/profile/about')} last />
        </Section>

        {/* Companion apps (YFT integration spec §6 / Our Apps §10) */}
        <Section title="Our Apps">
          <Row
            icon={<img src="/yft.png" alt="" aria-hidden style={{ width: 24, height: 24, borderRadius: 6 }} />}
            label="YFT"
            value="Personal Finance Tracker"
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
