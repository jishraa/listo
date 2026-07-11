import type { RefObject } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import type { List } from '../../types'
import type { ListCategory } from '../../lib/constants'

interface ItemEditRowProps {
  listType: List['type']
  hasCategories: boolean
  category: ListCategory | null
  title: string
  qty: string
  onTitleChange: (v: string) => void
  onQtyChange: (v: string) => void
  onOpenCategoryPicker: () => void
  onCommit: () => void
  onCancel: () => void
  onDelete: () => void
  /** Owned by the page — other flows (banner, insights, action sheet) focus it. */
  titleRef: RefObject<HTMLInputElement | null>
}

// Inline edit UI for one item. The edit state lives in the page (it's shared
// with the category picker and the completed-item action sheet); this is the
// presentation.
export default function ItemEditRow({
  listType, hasCategories, category, title, qty,
  onTitleChange, onQtyChange, onOpenCategoryPicker, onCommit, onCancel, onDelete, titleRef,
}: ItemEditRowProps) {
  return (
    <div style={{
      padding: '12px 16px', background: 'var(--bg-input)',
      borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div className="flex gap-2">
        <input
          ref={titleRef}
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          maxLength={200}
          style={{
            flex: 1, height: 40, borderRadius: 8, padding: '0 12px',
            background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
            color: 'var(--text)', fontSize: 16, outline: 'none',
          }}
        />
        {listType === 'shopping' && (
          <input
            value={qty}
            onChange={e => onQtyChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
            placeholder="Qty"
            maxLength={20}
            style={{
              width: 56, height: 40, borderRadius: 8, padding: '0 8px',
              background: 'var(--bg-input)', border: '1.5px solid var(--border-2)',
              color: 'var(--text)', fontSize: 16, outline: 'none', textAlign: 'center',
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        {hasCategories ? (
          <button
            onClick={onOpenCategoryPicker}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: category ? `${category.color}1f` : 'var(--bg-input)',
              color: category ? 'var(--text)' : 'var(--text-3)',
              border: 'none',
            }}>
            {category ? <>{category.emoji} {category.name}</> : '＋ Category'}
          </button>
        ) : <div />}
        <div className="flex gap-2" style={{ marginLeft: 8, flexShrink: 0 }}>
          {/* Delete here too — swipe is touch-only, this keeps removal
              reachable with a mouse or keyboard (undo toast still applies) */}
          <button onClick={onDelete}
            aria-label={`Delete ${title}`}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
            <Trash2 size={14} strokeWidth={2} />
          </button>
          <button onClick={onCancel} aria-label="Cancel editing"
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
            <X size={14} strokeWidth={2.2} />
          </button>
          <button onClick={onCommit} aria-label="Save changes"
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <Check size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
