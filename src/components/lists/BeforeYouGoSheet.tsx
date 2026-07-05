import { Check, Plus, ShoppingBag } from 'lucide-react'
import { useListsStore } from '../../store/useListsStore'
import { detectCategoryIn } from '../../lib/constants'
import type { List } from '../../types'
import type { ListCategory } from '../../lib/constants'
import type { MemoryItem } from '../../store/useMemoryStore'

// "Before you go" — a pre-checkout nudge listing the user's regulars that
// aren't on this list yet (from List Memory). One tap adds each with its usual
// quantity. `suggestions` is computed by the parent and shrinks reactively as
// items are added, so an emptied list shows the "all set" state.
interface Props {
  open: boolean
  onClose: () => void
  list: List
  cats: ListCategory[]
  suggestions: MemoryItem[]
}

export default function BeforeYouGoSheet({ open, onClose, list, cats, suggestions }: Props) {
  const store = useListsStore()
  if (!open) return null

  const add = (m: MemoryItem) => {
    const cat = m.category ?? detectCategoryIn(cats, m.name) ?? null
    store.addItem(list.id, m.name, m.lastQuantity ?? '', cat)
  }
  const addAll = () => suggestions.forEach(add)

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div style={{ padding: '10px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ShoppingBag size={18} color="var(--accent)" />
            <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Before you go</p>
          </div>

          {suggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
              <Check size={26} color="var(--accent)" strokeWidth={2.5} style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontWeight: 600 }}>You're all set</p>
              <p className="text-sm text-muted" style={{ marginTop: 2 }}>Nothing you usually buy is missing.</p>
              <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted" style={{ margin: '0 0 14px' }}>
                You usually buy these — tap to add anything you forgot.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {suggestions.map(m => (
                  <button
                    key={m.nameKey}
                    onClick={() => add(m)}
                    style={{
                      height: 38, padding: '0 14px', borderRadius: 19, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap',
                    }}
                  >
                    <Plus size={15} color="var(--accent)" />
                    {m.name}{m.lastQuantity ? ` ${m.lastQuantity}` : ''}
                  </button>
                ))}
              </div>
              <div className="flex gap-2" style={{ marginTop: 20 }}>
                {suggestions.length > 1 && (
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={addAll}>Add all</button>
                )}
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
