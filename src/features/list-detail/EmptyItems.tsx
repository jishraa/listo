import { ClipboardList, ListChecks, Plus, ShoppingCart } from 'lucide-react'
import { sectionLabel } from './helpers'
import type { List } from '../../types'
import type { MemoryItem } from '../../store/useMemoryStore'

interface EmptyItemsProps {
  listType: List['type']
  canEdit: boolean
  regulars: MemoryItem[]
  onAddItem: () => void
  onAddRegular: (m: MemoryItem) => void
}

// Compact, focused empty state (spec §1) + one-tap "your regulars" chips
// from List Memory to seed a fresh list.
export default function EmptyItems({ listType, canEdit, regulars, onAddItem, onAddRegular }: EmptyItemsProps) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 24px 8px' }}>
        <div aria-hidden style={{
          width: 64, height: 64, borderRadius: 18, background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
        }}>
          {listType === 'shopping'
            ? <ShoppingCart size={30} strokeWidth={1.8} />
            : listType === 'tasks'
              ? <ListChecks size={30} strokeWidth={1.8} />
              : <ClipboardList size={30} strokeWidth={1.8} />}
        </div>
        <p style={{ fontWeight: 700, fontSize: 17 }}>{canEdit ? 'Ready to start?' : 'Nothing here yet'}</p>
        <p className="text-muted text-sm" style={{ maxWidth: 264 }}>
          {!canEdit ? 'Items added by the group will show up here.'
            : listType === 'shopping' ? 'Add your first grocery item.' : listType === 'tasks' ? 'Add your first task.' : 'Add your first item.'}
        </p>
        {canEdit && (
          <button className="btn btn-primary" style={{ marginTop: 6, minHeight: 46 }} onClick={onAddItem}>
            <Plus size={18} /> Add Item
          </button>
        )}
      </div>

      {canEdit && regulars.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p style={sectionLabel}>Your regulars</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {regulars.map(m => (
              <button
                key={m.nameKey}
                onClick={() => onAddRegular(m)}
                style={{
                  height: 34, padding: '0 13px', borderRadius: 17, cursor: 'pointer',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  fontSize: 13, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap',
                }}
              >
                + {m.name}{m.lastQuantity ? ` ${m.lastQuantity}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
