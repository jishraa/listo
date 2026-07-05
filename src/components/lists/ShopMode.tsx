import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ShoppingCart, X } from 'lucide-react'
import { useListsStore } from '../../store/useListsStore'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

// Shop Mode — a focused, distraction-free in-store view. Items are grouped by
// category (aisle), rows are big tap-to-check targets, checked items drop into
// a collapsible "In cart", and the screen is kept awake while it's open.

interface Props {
  open: boolean
  onClose: () => void
  list: List
  items: ListItem[]
  cats: ListCategory[]
}

// Minimal typing for the Wake Lock API (not in the DOM lib on all targets).
type WakeLock = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }

export default function ShopMode({ open, onClose, list, items, cats }: Props) {
  const store = useListsStore()
  const [cartOpen, setCartOpen] = useState(false)

  // Keep the screen awake while shopping; re-acquire if the tab is backgrounded
  // and returns (the lock is dropped automatically on visibility loss).
  useEffect(() => {
    if (!open) return
    let sentinel: WakeLock | null = null
    let released = false
    const request = async () => {
      try { sentinel = await (navigator as WakeLockNavigator).wakeLock?.request('screen') ?? null } catch { /* unsupported / denied */ }
    }
    request()
    const onVis = () => { if (document.visibilityState === 'visible' && !released) request() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVis)
      sentinel?.release().catch(() => {})
    }
  }, [open])

  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])

  const pending = items.filter(i => !i.completed)
  const done    = items.filter(i => i.completed)

  // Group pending items by category (aisle), preserving the categories' order;
  // uncategorized items go last.
  const groups = useMemo(() => {
    const byCat = new Map<string, ListItem[]>()
    for (const i of pending) {
      const key = i.category && catById.has(i.category) ? i.category : '__none'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key)!.push(i)
    }
    const out: { cat: ListCategory | null; items: ListItem[] }[] = []
    for (const c of cats) if (byCat.has(c.id)) out.push({ cat: c, items: byCat.get(c.id)! })
    if (byCat.has('__none')) out.push({ cat: null, items: byCat.get('__none')! })
    return out
  }, [pending, cats, catById])

  if (!open) return null

  const total = items.length
  const doneCount = done.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const allDone = total > 0 && pending.length === 0

  const toggle = (item: ListItem) => {
    navigator.vibrate?.(10)
    store.toggleItem(list.id, item)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: 'calc(12px + var(--safe-top)) 16px 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingCart size={20} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '1px 0 0' }}>
              {allDone ? 'All done' : `${pending.length} left · ${doneCount} of ${total} in cart`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Exit Shop Mode"
            style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--bg-input)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0 }}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        {/* Progress */}
        <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-input)', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 260ms var(--ease)' }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px calc(24px + var(--safe-bottom))' }}>
        {allDone ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <p style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>Everything's in the cart</p>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>Nice work — you got it all.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Done shopping</button>
          </div>
        ) : (
          groups.map(({ cat, items: gItems }) => (
            <div key={cat?.id ?? '__none'} style={{ marginBottom: 18 }}>
              <p style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase',
                letterSpacing: '0.06em', margin: '4px 6px 8px',
              }}>
                {cat ? `${cat.emoji} ${cat.name}` : 'Other'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                      minHeight: 62, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                      background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                      border: '2px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </span>
                    {item.quantity && (
                      <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{item.quantity}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* In cart — collapsible, tap to uncheck if grabbed by mistake */}
        {done.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setCartOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              <ShoppingCart size={14} /> In cart ({done.length})
              <ChevronDown size={15} style={{ marginLeft: 'auto', transform: cartOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
            </button>
            {cartOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {done.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                      background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'left', opacity: 0.6,
                    }}
                  >
                    <span style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={13} strokeWidth={3} color="#fff" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text-3)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}{item.quantity ? ` ${item.quantity}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
