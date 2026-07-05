import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

// "New version available · Update" — the safe update experience for the PWA.
// registerType is 'prompt', so a new deploy never swaps code mid-session;
// the user applies it with one tap (or on the next full launch).
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() { /* SW unsupported (e.g. some webviews) — app works without it */ },
  })

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 14px)', left: 16, right: 16,
      zIndex: 300, display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-card)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
      boxShadow: 'var(--shadow)', maxWidth: 448, margin: '0 auto',
    }}>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
        New version available
      </span>
      <button
        onClick={() => setNeedRefresh(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', padding: '6px 4px' }}>
        Later
      </button>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700,
        }}>
        <RefreshCw size={13} /> Update
      </button>
    </div>
  )
}
