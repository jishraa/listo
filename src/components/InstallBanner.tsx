import type { ReactNode } from 'react'
import { Download, Plus, Share, X } from 'lucide-react'
import type { InstallPrompt } from '../hooks/useInstallPrompt'

export default function InstallBanner({ canShow, platform, install, dismiss }: InstallPrompt) {
  if (!canShow) return null

  return (
    <div style={{
      margin: '0 16px 4px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(22,163,74,0.07) 0%, rgba(168,85,247,0.05) 100%)',
      border: '1px solid rgba(22,163,74,0.20)',
      boxShadow: '0 0 28px rgba(22,163,74,0.07), inset 0 1px 0 rgba(22,163,74,0.08)',
      padding: '14px 14px 14px 16px',
      position: 'relative',
    }}>
      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0,
          border: 'none',
        }}
      >
        <X size={13} strokeWidth={2.5} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingRight: 22 }}>
        {/* App icon */}
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0, overflow: 'hidden',
          border: '1.5px solid rgba(22,163,74,0.22)',
          boxShadow: '0 0 14px rgba(22,163,74,0.18)',
        }}>
          <img src="./apple-touch-icon.png" alt="Listo" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: 'var(--text)' }}>
            Add Listo to Home Screen
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 11, lineHeight: 1.45 }}>
            Install for a full-screen app experience — no browser bar.
          </p>

          {platform === 'android' ? (
            <button
              onClick={install}
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12, padding: '7px 16px', gap: 6, height: 34 }}
            >
              <Download size={13} strokeWidth={2.5} />
              Install App
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Step icon={<Share size={12} />} text='Tap the Share button below' />
              <Step icon={<Plus size={12} />} text='Tap "Add to Home Screen"' />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)',
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.3 }}>{text}</span>
    </div>
  )
}
