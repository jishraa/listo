import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore, applyTheme } from './store/useThemeStore'
import Login from './pages/Login'
import Home from './pages/Home'
import Lists from './pages/Lists'
import Insights from './pages/Insights'
import ListDetail from './pages/ListDetail'
import JoinList from './pages/JoinList'
import Profile from './pages/Profile'
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
      <Route path="/join/:code" element={<JoinList />} />
      {/* Tab pages render inside the AppShell (bottom nav + create FAB) */}
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      {/* Drill-in page — full-screen, own header, no bottom nav */}
      <Route
        path="/list/:id"
        element={
          <AuthGuard>
            <ListDetail />
          </AuthGuard>
        }
      />
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
