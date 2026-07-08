import { Pin, Users } from 'lucide-react'
import { formatRelativeTime } from '../../lib/utils'
import type { List } from '../../types'

interface ListCardProps {
  list: List
  isPinned: boolean
  items: { completed: boolean }[]
  /** Consolidated collaborator label (names or "N members"); undefined = personal */
  collab?: string
  onOpen: () => void
}

// One list card on the home screen: emoji tile, name + status, collaboration
// line, and a progress bar once progress has started.
export default function ListCard({ list, isPinned, items, collab, onOpen }: ListCardProps) {
  const total = items.length
  const done = items.filter(i => i.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total
  const left = total - done
  // Actionable status, no fractions (spec §4): users shouldn't have to
  // calculate what's remaining. Untouched lists just state their size.
  const status =
    total === 0 ? 'Empty'
    : allDone ? '✓ Done'
    : done === 0 ? `${total} ${total === 1 ? 'item' : 'items'}`
    : `${left} ${left === 1 ? 'item' : 'items'} left`

  const typeBgClass = { personal: 'type-bg-personal', tasks: 'type-bg-tasks', shopping: 'type-bg-shopping' }[list.type]

  return (
    <div className="card card-press" style={{ padding: '16px', cursor: 'pointer' }} onClick={onOpen}>
      <div className="flex items-center gap-3">
        <div className={typeBgClass} style={{
          width: 46, height: 46, borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>
          {list.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 1 — List name, with the done/total count pinned right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              {isPinned && <Pin size={11} color="var(--accent)" fill="var(--accent)" style={{ flexShrink: 0 }} />}
              <span style={{ fontWeight: 600, fontSize: 17 }} className="truncate">{list.name}</span>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 12.5, fontWeight: allDone ? 700 : 600,
              color: allDone ? '#00e087' : 'var(--text-3)',
            }}>
              {status}
            </span>
          </div>
          {/* 2 — Collaboration · updated time, one non-wrapping line */}
          <div className="flex items-center" style={{ gap: 5, marginTop: 4, minWidth: 0 }}>
            {collab && <Users size={12} color="var(--text-3)" style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {collab ? `${collab} · ${formatRelativeTime(list.updated_at)}` : `Updated ${formatRelativeTime(list.updated_at)}`}
            </span>
          </div>
          {/* 3 — Progress, inset to the content column; only rendered once
              progress has started — no empty bars at 0% (spec §progress) */}
          {done > 0 && (
            <div className="progress-bar" style={{ marginTop: 9, height: 7 }}>
              <div className="progress-fill" style={{
                width: `${pct}%`,
                background: allDone ? '#00e087' : 'var(--accent)',
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
