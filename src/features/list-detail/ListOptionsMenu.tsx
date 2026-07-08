import type { ReactNode } from 'react'
import Sheet from '../../components/ui/Sheet'

export type MenuRowSpec = { icon: ReactNode; label: string; onClick: () => void; right?: string; danger?: boolean }
export type MenuGroupSpec = { label: string; rows: MenuRowSpec[] }

interface ListOptionsMenuProps {
  open: boolean
  onClose: () => void
  /** Context-aware groups built by the page; empty groups are dropped. */
  groups: MenuGroupSpec[]
}

// The grouped, titled List Options sheet (spec §6–§20). The page decides
// WHICH actions exist; this renders them.
export default function ListOptionsMenu({ open, onClose, groups }: ListOptionsMenuProps) {
  return (
    <Sheet open={open} onClose={onClose} title="List Options">
      <div className="ld-menu">
        {groups.filter(g => g.rows.length > 0).map(g => (
          <div key={g.label} className="ld-menu-group">
            <p className="ld-menu-label">{g.label}</p>
            {g.rows.map((r, i) => (
              <button
                key={i}
                className={`ld-menu-row${r.danger ? ' danger' : ''}`}
                onClick={r.onClick}
              >
                <span className="ld-row-icon">{r.icon}</span>
                <span className="ld-row-label">{r.label}</span>
                {r.right && <span className="ld-row-right">{r.right}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
