import { Plus, RefreshCw, Share2, Sparkles } from 'lucide-react'
import { openYft } from '../../lib/yft'
import { formatCompletedAt } from './helpers'
import type { List } from '../../types'
import type { ListCategory } from '../../lib/constants'

export interface TripSummary {
  count: number
  aisles: number
  chips: { cat: ListCategory; n: number }[]
}

interface CompletionCardProps {
  list: List
  tripSummary: TripSummary
  completionTime: string | null
  canEdit: boolean
  isOwner: boolean
  onViewInsights: () => void
  onAddMore: () => void
  onNextTrip: () => void
  onShare: () => void
}

// Celebration card shown when every item is complete: trip summary, next
// steps (spec §9), and the YFT companion nudge for shopping lists.
export default function CompletionCard({
  list, tripSummary, completionTime, canEdit, isOwner,
  onViewInsights, onAddMore, onNextTrip, onShare,
}: CompletionCardProps) {
  const isShopping = list.type === 'shopping'
  return (
    <div style={{
      borderRadius: 14, padding: '18px 16px',
      background: 'linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0.06) 100%)',
      border: '1px solid rgba(22,163,74,0.3)',
    }}>
      <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
        {isShopping ? 'Shopping complete! 🎉' : 'All done! 🎉'}
      </p>
      {/* Trip summary — what this run covered */}
      <p className="text-sm" style={{ color: 'var(--text-2)', margin: '0 0 2px' }}>
        {isShopping
          ? <>You picked up <strong>{tripSummary.count} {tripSummary.count === 1 ? 'item' : 'items'}</strong>{tripSummary.aisles > 1 ? <> across <strong>{tripSummary.aisles} aisles</strong></> : null}.</>
          : <>You completed <strong>{tripSummary.count} {tripSummary.count === 1 ? 'item' : 'items'}</strong>.</>}
      </p>
      {completionTime && <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>Completed {formatCompletedAt(completionTime)}</p>}
      {/* Category breakdown chips (shopping) */}
      {isShopping && tripSummary.chips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 14px' }}>
          {tripSummary.chips.slice(0, 6).map(({ cat, n }) => (
            <span key={cat.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
              background: `${cat.color}1f`, padding: '3px 9px', borderRadius: 99,
            }}>
              {cat.emoji} {cat.name} · {n}
            </span>
          ))}
        </div>
      )}
      {/* Primary next step (spec §9): review what you bought */}
      <button onClick={onViewInsights} className="btn btn-primary btn-full" style={{ marginBottom: 8 }}>
        <Sparkles size={15} /> View Insights
      </button>
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        {canEdit && <button onClick={onAddMore}
          className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}><Plus size={14} /> Add more</button>}
        {canEdit && <button onClick={onNextTrip}
          className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
          <RefreshCw size={13} /> Start next trip
        </button>}
        {isOwner && <button onClick={onShare} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(22,163,74,0.4)', color: 'var(--accent)' }}>
          <Share2 size={13} /> Share
        </button>}
      </div>
      {/* Companion nudge — shopping done → record the expense in YFT */}
      {isShopping && (
        <button
          onClick={() => openYft('/tracker/monthly')}
          style={{
            width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
          }}>
          <img src="/yft.png" alt="YFT" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>
            Record today's shopping expense?
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            Track in YFT →
          </span>
        </button>
      )}
    </div>
  )
}
