import Sheet from '../../components/ui/Sheet'
import type { ViewPrefs } from './helpers'

const ROWS = [
  { key: 'categories', title: 'Categories', desc: 'Show item categories' },
  { key: 'addedBy', title: 'Added By', desc: 'Show who added each item' },
  { key: 'autoExpand', title: 'Completed Items', desc: 'Automatically expand completed items' },
  { key: 'remember', title: 'Remember for this list', desc: 'Save these choices for next time' },
] as const

interface CustomizeViewSheetProps {
  open: boolean
  onClose: () => void
  prefs: ViewPrefs
  onChange: (patch: Partial<ViewPrefs>) => void
}

// Customize List View (spec §4.2) — per-list toggles for what each row shows.
export default function CustomizeViewSheet({ open, onClose, prefs, onChange }: CustomizeViewSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Customize List View" subtitle="Choose what shows on each item.">
      <div className="sheet-body">
        <div>
          {ROWS.map(row => {
            const on = prefs[row.key]
            return (
              <div key={row.key} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{row.title}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '2px 0 0' }}>{row.desc}</p>
                </div>
                <button
                  role="switch" aria-checked={on} aria-label={row.title}
                  onClick={() => onChange({ [row.key]: !on })}
                  style={{
                    flexShrink: 0, width: 46, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: on ? 'var(--accent)' : 'var(--bg-input)',
                    position: 'relative', transition: 'background 180ms ease',
                  }}>
                  <span style={{
                    position: 'absolute', top: 3, left: on ? 21 : 3,
                    width: 22, height: 22, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 180ms var(--ease)',
                  }} />
                </button>
              </div>
            )
          })}
        </div>
        <button className="btn btn-primary btn-full" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
}
