import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useListsStore } from './store/useListsStore'
import { useSyncStore } from './store/useSyncStore'
import { useThemeStore, applyTheme } from './store/useThemeStore'
import { CloudOff, RefreshCw } from 'lucide-react'
import AppShell from './components/layout/AppShell'
import UpdateToast from './components/UpdateToast'
// Entry screens stay eager; everything reachable one tap deeper is lazy so
// the initial bundle only carries login + the lists workspace.
import Login from './pages/Login'
import Lists from './pages/Lists'
import JoinList from './pages/JoinList'

const Landing           = lazy(() => import('./pages/Landing'))
const ListDetail        = lazy(() => import('./pages/ListDetail'))
const ResetPassword     = lazy(() => import('./pages/ResetPassword'))
const Profile           = lazy(() => import('./pages/Profile'))
const Categories        = lazy(() => import('./pages/Categories'))
const Terms             = lazy(() => import('./pages/Legal').then(m => ({ default: m.Terms })))
const Privacy           = lazy(() => import('./pages/Legal').then(m => ({ default: m.Privacy })))
const AccountPage       = lazy(() => import('./pages/profile/Account'))
const PreferencesPage   = lazy(() => import('./pages/profile/Preferences'))
const CollaborationPage = lazy(() => import('./pages/profile/Collaboration'))
const InvitePage        = lazy(() => import('./pages/profile/Invite'))
const SupportPage       = lazy(() => import('./pages/profile/Support'))
const AboutPage         = lazy(() => import('./pages/profile/About'))
const HelpSupportPage   = lazy(() => import('./pages/profile/HelpSupport'))

// Profile hub sub-screens (spec v4) — same guard + layout, mapped by path.
const PROFILE_SUBPAGES: [string, React.ComponentType][] = [
  ['/profile/account', AccountPage],
  ['/profile/preferences', PreferencesPage],
  ['/profile/collaboration', CollaborationPage],
  ['/profile/invite', InvitePage],
  ['/profile/support', SupportPage],
  ['/profile/about', AboutPage],
  ['/profile/help', HelpSupportPage],
]

function PageLoader() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  )
}

function AuthGuard({ children, allowGuest = true }: { children: React.ReactNode; allowGuest?: boolean }) {
  const { user, loading, isGuest } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true, state: { from: location } })
    }
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  // Guests (anonymous sessions) can browse their joined lists and the Profile
  // tab (to upgrade or leave), but member-only surfaces like Categories opt out
  // via allowGuest={false} and bounce them back to their lists.
  if (isGuest && !allowGuest) return <Navigate to="/" replace />

  return <>{children}</>
}

// Root gate: the marketing landing page is public at "/" for signed-out
// visitors, while authenticated users get the tab shell in place (so the
// installed PWA still opens straight to their lists). AppShell renders the
// <Outlet/> → Lists or Profile — one shell instance across tab switches, so
// the bottom nav persists and shell data loading doesn't re-fire per switch.
function RootGate() {
  const { user, loading } = useAuthStore()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  if (!user) {
    // "/" doubles as the public landing; other shell paths (/profile) need auth.
    return pathname === '/' ? <Landing /> : <Navigate to="/login" replace />
  }
  return <AppShell />
}

// Connectivity + queue flushing (offline-first part C): tracks online state,
// replays queued writes on reconnect, and shows a subtle status pill while
// offline or syncing.
function SyncController() {
  const online = useSyncStore(s => s.online)
  const syncing = useSyncStore(s => s.syncing)
  const queueLen = useSyncStore(s => s.queue.length)

  useEffect(() => {
    const sync = useSyncStore.getState()
    const onOnline = async () => {
      sync.setOnline(true)
      await sync.flush()
      // Pull remote changes made while we were away
      useListsStore.getState().refreshLists()
    }
    const onOffline = () => sync.setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    // Startup flush: ops left over from a previous offline session
    sync.flush()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const showSyncing = syncing && queueLen > 0
  if (online && !showSyncing) return null

  return (
    <div style={{
      position: 'fixed', top: 'calc(8px + var(--safe-top))', left: '50%', transform: 'translateX(-50%)',
      zIndex: 400, display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 99,
      background: 'var(--bg-card)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
      fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap',
    }}>
      {!online ? (
        <>
          <CloudOff size={13} color="#d97706" />
          Offline{queueLen > 0 ? ` · ${queueLen} pending` : ' — changes will sync'}
        </>
      ) : (
        <>
          <RefreshCw size={13} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
          Syncing {queueLen} {queueLen === 1 ? 'change' : 'changes'}…
        </>
      )}
    </div>
  )
}

function ThemeController() {
  const { pref } = useThemeStore()

  useEffect(() => {
    applyTheme(pref)
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [pref])

  return null
}

function AppRoutes() {
  const { init } = useAuthStore()

  useEffect(() => {
    init()
  }, [])

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/join/:code" element={<JoinList />} />
      {/* Public marketing landing — always reachable, even when signed in
          (so authenticated visitors see it with the "Open Listo" CTA). */}
      <Route path="/about" element={<Landing />} />
      {/* "/" is public: RootGate shows the landing to signed-out visitors and
          the tab shell (AppShell → Lists / Profile) to authenticated ones.
          Profile lives here so the bottom nav persists across tab switches. */}
      <Route path="/" element={<RootGate />}>
        <Route index element={<Lists />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      {/* Old dashboard/insights URLs — Lists is the root screen now */}
      <Route path="/lists" element={<Navigate to="/" replace />} />
      <Route path="/insights" element={<Navigate to="/" replace />} />
      {/* Drill-in pages — full-screen, own header, no bottom nav */}
      <Route
        path="/list/:id"
        element={
          <AuthGuard>
            <ListDetail />
          </AuthGuard>
        }
      />
      <Route
        path="/categories"
        element={
          <AuthGuard allowGuest={false}>
            <Categories />
          </AuthGuard>
        }
      />
      {PROFILE_SUBPAGES.map(([path, Page]) => (
        <Route key={path} path={path} element={<AuthGuard><Page /></AuthGuard>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeController />
      <SyncController />
      <AppRoutes />
      <UpdateToast />
    </BrowserRouter>
  )
}
