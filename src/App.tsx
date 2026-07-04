import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore, applyTheme } from './store/useThemeStore'
import Login from './pages/Login'
import Lists from './pages/Lists'
import ListDetail from './pages/ListDetail'
import JoinList from './pages/JoinList'
import Profile from './pages/Profile'
import { Terms, Privacy } from './pages/Legal'
import Categories from './pages/Categories'
import AccountPage from './pages/profile/Account'
import PreferencesPage from './pages/profile/Preferences'
import CollaborationPage from './pages/profile/Collaboration'
import InsightsPage from './pages/profile/Insights'
import InvitePage from './pages/profile/Invite'
import AboutPage from './pages/profile/About'
import AppShell from './components/layout/AppShell'

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
        <Route path="/profile" element={<Profile />} />
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
      {/* Profile hub sub-screens (spec v4) */}
      {([
        ['/profile/account', <AccountPage />],
        ['/profile/preferences', <PreferencesPage />],
        ['/profile/collaboration', <CollaborationPage />],
        ['/profile/insights', <InsightsPage />],
        ['/profile/invite', <InvitePage />],
        ['/profile/about', <AboutPage />],
      ] as [string, React.ReactElement][]).map(([path, el]) => (
        <Route key={path} path={path} element={<AuthGuard>{el}</AuthGuard>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
