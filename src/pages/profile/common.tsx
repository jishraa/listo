import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Drill-in page scaffold: back header + scrolling padded content.
export function SubPage({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={20} />
        </button>
        <span className="header-title">{title}</span>
      </div>
      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && (
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px 8px' }}>
          {title}
        </p>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

export function Row({ icon, label, value, valueColor, onPress, last = false }: {
  icon?: React.ReactNode; label: string; value?: string; valueColor?: string
  onPress?: () => void; last?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 54,
        padding: '13px 16px', background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default',
        borderBottom: last ? 'none' : '1px solid var(--border)', textAlign: 'left',
      }}
    >
      {icon && <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</span>}
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

// Moved to src/hooks/useEnsureData.ts — re-exported so existing profile
// imports keep working.
export { useEnsureData } from '../../hooks/useEnsureData'
