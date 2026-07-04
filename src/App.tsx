import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore, applyTheme } from './store/useThemeStore'
import AppShell from './components/layout/AppShell'
// Entry screens stay eager; everything reachable one tap deeper is lazy so
// the initial bundle only carries login + the lists workspace.
import Login from './pages/Login'
import Lists from './pages/Lists'
import JoinList from './pages/JoinList'

const ListDetail        = lazy(() => import('./pages/ListDetail'))
const Profile           = lazy(() => import('./pages/Profile'))
const Categories        = lazy(() => import('./pages/Categories'))
const Terms             = lazy(() => import('./pages/Legal').then(m => ({ default: m.Terms })))
const Privacy           = lazy(() => import('./pages/Legal').then(m => ({ default: m.Privacy })))
const AccountPage       = lazy(() => import('./pages/profile/Account'))
const PreferencesPage   = lazy(() => import('./pages/profile/Preferences'))
const CollaborationPage = lazy(() => import('./pages/profile/Collaboration'))
const InsightsPage      = lazy(() => import('./pages/profile/Insights'))
const InvitePage        = lazy(() => import('./pages/profile/Invite'))
const AboutPage         = lazy(() => import('./pages/profile/About'))

// Profile hub sub-screens (spec v4) — same guard + layout, mapped by path.
const PROFILE_SUBPAGES: [string, React.ComponentType][] = [
  ['/profile/account', AccountPage],
  ['/profile/preferences', PreferencesPage],
  ['/profile/collaboration', CollaborationPage],
  ['/profile/insights', InsightsPage],
  ['/profile/invite', InvitePage],
  ['/profile/about', AboutPage],
]

function PageLoader() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
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

  // Guests can only access join pages and list detail if they're already a member
  return <>{children}</>
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
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/join/:code" element={<JoinList />} />
      {/* Tab pages render inside the AppShell (bottom nav + create FAB) */}
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Lists />} />
        {/* Old dashboard/insights URLs — Lists is the root screen now */}
        <Route path="/lists" element={<Navigate to="/" replace />} />
        <Route path="/insights" element={<Navigate to="/" replace />} />
      </Route>
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
          <AuthGuard>
            <Categories />
          </AuthGuard>
        }
      />
      <Route
        path="/profile"
        element={
          <AuthGuard>
            <Profile />
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
      <AppRoutes />
    </BrowserRouter>
  )
}
