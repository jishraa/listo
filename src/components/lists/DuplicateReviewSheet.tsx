import { useEffect, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useListsStore } from '../../store/useListsStore'
import { analyzeGroup } from '../../lib/duplicates'
import type { List, ListItem } from '../../types'

// Quantity-aware duplicate review (spec §4). Contextual, staged actions:
// exact duplicates offer removal, count/same-unit groups offer a merge with
// preview, ambiguous groups only ever merge on explicit confirmation.
// Nothing applies until the user taps Apply. Detection logic lives in
// lib/duplicates (pending-only) and is unit-tested.

interface Props {
  open: boolean
  onClose: () => void
  list: List
  groups: Map<string, ListItem[]>
  /** Shared list → show "by member" on each row */
  shared: boolean
}

export default function DuplicateReviewSheet({ open, onClose, list, groups, shared }: Props) {
  const store = useListsStore()
  // Group keys staged for their suggested action; absence = keep both.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)

  // Fresh selection every time the sheet opens
  useEffect(() => { if (open) setSelected(new Set()) }, [open])

  const toggle = (key: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  // Staged changes (ignores any stale keys not in the current groups)
  const changes = [...groups.keys()].filter(k => selected.has(k)).length

  // Apply every staged group: keep the first item (with merged quantity where
  // applicable) and remove the rest. Keep-both groups are untouched.
  async function applyPlan() {
    for (const [key, group] of groups.entries()) {
      if (!selected.has(key)) continue
      const plan = analyzeGroup(group)
      const [first, ...rest] = group
      if (plan.merged && plan.merged !== first.quantity) {
        await store.updateItem(list.id, first.id, { title: first.title, quantity: plan.merged, category: first.category })
      }
      for (const r of rest) await store.deleteItem(list.id, r.id)
    }
    setSelected(new Set())
    onClose()
    setResolved(true)
    setTimeout(() => setResolved(false), 2200)
  }

  return (
    <>
      {open && (
        <>
          <div className="sheet-overlay" onClick={onClose} />
          <div className="sheet" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ padding: '10px 20px 24px' }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Review duplicates</p>
              <p className="text-sm text-muted" style={{ margin: '0 0 16px' }}>
                Merge, remove, or keep similar items.
              </p>
              {groups.size === 0 ? (
                <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
                  No duplicates left 🎉
                </p>
              ) : [...groups.entries()].map(([key, group]) => {
                const plan = analyzeGroup(group)
                const isSelected = selected.has(key)
                const keepLabel = group.length > 2 ? 'Keep All' : 'Keep Both'
                // The destructive removal action is styled red only for exact
                // duplicates; merges are the neutral accent (spec).
                const isRemoval = plan.kind === 'exact'
                return (
                  <div key={key} style={{ marginBottom: 18 }}>
                    <div className="flex items-baseline justify-between" style={{ margin: '0 2px 8px' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{group[0].title}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{group.length} similar items</span>
                    </div>
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {group.map((it, i) => (
                        <div key={it.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          background: 'var(--bg-card)', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                              {it.title}{it.quantity ? ` ${it.quantity}` : ''}
                              {it.completed && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>✓</span>}
                            </span>
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                              {i === 0 ? 'Original' : 'Added later'}
                              {shared && it.added_by_name ? ` · by ${it.added_by_name}` : ''}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Merge preview */}
                    {isSelected && plan.merged && (
                      <p style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, margin: '8px 2px 0' }}>
                        {group.map(i => `${group[0].title}${i.quantity ? ` ${i.quantity}` : ''}`).join(' + ')} → {group[0].title} {plan.merged}
                      </p>
                    )}

                    {/* Contextual actions */}
                    <div className="flex" style={{ gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => toggle(key)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          border: isSelected
                            ? 'none'
                            : `1px solid ${isRemoval ? 'rgba(239,68,68,0.35)' : 'var(--border-2)'}`,
                          background: isSelected ? (isRemoval ? '#ef4444' : 'var(--accent)') : 'transparent',
                          color: isSelected ? '#fff' : (isRemoval ? '#ef4444' : 'var(--accent)'),
                        }}>
                        {isRemoval && <Trash2 size={14} />}{plan.mergeLabel}
                      </button>
                      <button
                        onClick={() => { if (isSelected) toggle(key) }}
                        style={{
                          flex: 1, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          border: !isSelected ? '1px solid var(--border-2)' : 'none',
                          background: !isSelected ? 'var(--bg-input)' : 'transparent',
                          color: 'var(--text-2)',
                        }}>
                        {keepLabel}
                      </button>
                    </div>

                    {/* Suggested hint */}
                    {plan.suggestMerge && !isSelected && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '6px 2px 0' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Suggested:</span> {plan.mergeLabel}
                      </p>
                    )}
                  </div>
                )
              })}
              <button
                className="btn btn-primary btn-full"
                onClick={() => changes > 0 ? applyPlan() : onClose()}
                style={{ marginTop: 4 }}>
                {changes === 0 ? 'Done' : changes === 1 ? 'Apply Changes' : `Apply ${changes} Changes`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Post-apply confirmation — outlives the sheet itself */}
      {resolved && (
        <div className="list-fade-in" style={{
          position: 'fixed', bottom: 84, left: 16, right: 16, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--bg-card)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 16, padding: '13px 16px', boxShadow: 'var(--shadow)',
        }}>
          <Check size={16} color="var(--accent)" strokeWidth={2.5} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Duplicates resolved</span>
        </div>
      )}
    </>
  )
}
