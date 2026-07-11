import { useState } from 'react'
import { Check } from 'lucide-react'
import { SwipeRow } from '../../components/lists/SwipeRow'
import { friendlyName, formatQuantity } from '../../lib/utils'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

interface ItemRowProps {
  item: ListItem
  listType: List['type']
  canEdit: boolean
  /** The single remaining pending item gets a subtle highlight (spec §1). */
  isFinalItem: boolean
  isDup: boolean
  cat: ListCategory | null
  showCategory: boolean
  showAddedBy: boolean
  isSharedList: boolean
  displayName: string
  onToggle: () => void
  /** Tap on the title area — pending opens edit, completed opens actions. */
  onOpen: () => void
  onDelete: () => void
  onSaveQty: (qty: string | null) => void
}

// One item row: swipe-to-delete, checkbox, title + metadata, quantity chip
// with its own inline editor. Pure display + callbacks — no store access.
export default function ItemRow({
  item, listType, canEdit, isFinalItem, isDup, cat,
  showCategory, showAddedBy, isSharedList, displayName,
  onToggle, onOpen, onDelete, onSaveQty,
}: ItemRowProps) {
  // Inline quantity editing is this row's own concern.
  const [qtyEditing, setQtyEditing] = useState(false)
  const [qtyDraft, setQtyDraft] = useState('')

  const commitQty = () => {
    onSaveQty(qtyDraft.trim() || null)
    setQtyEditing(false)
  }

  const showCat = !!cat && showCategory
  const person = (n: string) => n === displayName ? 'You' : friendlyName(n)
  // No "✓" here — the green check already signals completion (spec).
  const rawWho = !showAddedBy ? null : item.completed
    ? (item.completed_by_name ? person(item.completed_by_name) : null)
    : (isSharedList && item.added_by_name ? person(item.added_by_name) : null)
  const who = rawWho && showCat ? `· ${rawWho}` : rawWho

  return (
    <SwipeRow onDelete={onDelete} disabled={!canEdit}>
      {isFinalItem && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px 0',
          background: 'var(--accent-dim)', fontSize: 11, fontWeight: 700,
          color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          🛒 Last item
        </div>
      )}
      <div className="flex items-center gap-3" style={{ padding: '11px 14px', background: isFinalItem ? 'var(--accent-dim)' : 'var(--bg-card)' }}>
        {/* Checkbox — 44px touch target around the 22px control (spec §17) */}
        <button
          onClick={() => { if (canEdit) onToggle() }}
          disabled={!canEdit}
          aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
          style={{
            flexShrink: 0, width: 40, height: 40, margin: -9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${item.completed ? 'var(--accent)' : 'var(--border-2)'}`,
            background: item.completed ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 180ms ease',
          }}>
            {item.completed && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
          </span>
        </button>

        {/* Title area — pending: tap to edit; completed: tap for actions */}
        <div
          onClick={() => { if (canEdit) onOpen() }}
          style={{ flex: 1, minWidth: 0, cursor: canEdit ? 'pointer' : 'default' }}
        >
          <div className="flex items-center gap-2">
            <span style={{
              fontSize: 17, fontWeight: 600,
              // Completed items are secondary, not disabled — keep them readable.
              color: item.completed ? 'var(--text-2)' : 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 200ms ease',
            }}>{item.title}</span>
            {isDup && (
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 600,
                color: '#d97706', background: 'rgba(217,119,6,0.12)',
                borderRadius: 99, padding: '2px 6px',
              }}>Dup</span>
            )}
          </div>
          {/* Metadata row respects the per-list view prefs (spec §4.2):
              "Category · Member" — friendly names, "You" for own items. */}
          {(showCat || who) && (
            <div className="flex items-center" style={{ gap: 6, marginTop: 3 }}>
              {showCat && (
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 600, lineHeight: 1,
                  padding: '3px 7px', borderRadius: 6,
                  background: item.completed ? 'var(--bg-input)' : `${cat!.color}1f`,
                  color: 'var(--text-2)',
                }}>{cat!.name}</span>
              )}
              {who && (
                <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
              )}
            </div>
          )}
        </div>

        {/* Qty chip (shopping only) — shown only when a meaningful quantity
            exists (no "—" placeholder, no ×1); qty is set via the item text
            ("Milk 2") or the edit flow */}
        {listType === 'shopping' && !item.completed && (item.quantity || qtyEditing) && (
          qtyEditing ? (
            <input
              autoFocus
              value={qtyDraft}
              onChange={e => setQtyDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitQty()
                if (e.key === 'Escape') setQtyEditing(false)  // cancel, no save
              }}
              onBlur={commitQty}
              placeholder="Qty"
              maxLength={20}
              style={{
                flexShrink: 0, width: 58, height: 28, borderRadius: 99, padding: '0 8px',
                textAlign: 'center', background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
                // 16px avoids iOS Safari focus-zoom on this inline quantity field
                color: 'var(--text)', fontSize: 16, fontWeight: 600, outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={e => { e.stopPropagation(); if (canEdit) { setQtyDraft(item.quantity ?? ''); setQtyEditing(true) } }}
              disabled={!canEdit}
              aria-label={`Quantity ${formatQuantity(item.quantity)}`}
              style={{
                flexShrink: 0, padding: '3px 9px', borderRadius: 99,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default',
                color: 'var(--text-2)',
              }}
            >{formatQuantity(item.quantity)}</button>
          )
        )}
        {listType === 'shopping' && item.completed && item.quantity && (
          <span aria-label={`Quantity ${formatQuantity(item.quantity)}`} style={{
            flexShrink: 0, padding: '3px 9px', borderRadius: 99,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
          }}>{formatQuantity(item.quantity)}</span>
        )}
      </div>
    </SwipeRow>
  )
}
