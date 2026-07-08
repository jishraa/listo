import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ShoppingCart, X } from 'lucide-react'
import IconButton from '../ui/IconButton'
import { useListsStore } from '../../store/useListsStore'
import { formatQuantity } from '../../lib/utils'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

// Shop Mode — a focused, distraction-free in-store view. Items are grouped by
// category (aisle), rows are big tap-to-add targets, tapped items drop into a
// collapsible "In Cart", an Undo snackbar guards accidental taps, and a clear
// Finish Shopping state closes out the trip. The screen is kept awake while open.

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
  // Lightweight undo after adding an item to the cart (spec §Undo).
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashUndo(item: ListItem) {
    setUndo({ id: item.id, title: item.title })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 4000)
  }
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])
  // Never carry a stale snackbar across an exit/resume.
  useEffect(() => { if (!open) { setUndo(null); if (undoTimer.current) clearTimeout(undoTimer.current) } }, [open])

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
  // uncategorized items go last. Empty categories naturally drop out.
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

  // Tap a remaining item → into the cart, with an Undo snackbar.
  const addToCart = (item: ListItem) => {
    navigator.vibrate?.(10)
    store.toggleItem(list.id, item)
    flashUndo(item)
  }
  // Tap an In Cart item → back to its category (second recovery path).
  const removeFromCart = (item: ListItem) => {
    navigator.vibrate?.(10)
    store.toggleItem(list.id, item)
    if (undo?.id === item.id) { setUndo(null); if (undoTimer.current) clearTimeout(undoTimer.current) }
  }
  const handleUndo = () => {
    if (!undo) return
    const it = items.find(i => i.id === undo.id && i.completed)
    if (it) store.toggleItem(list.id, it)
    setUndo(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }
  // Finish Shopping: the trip's state already lives on the items (completed =
  // in cart) and history was recorded as they were added, so this returns to
  // List Details — which shows the completion celebration + Insights entry.
  const finishShopping = () => onClose()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: 'calc(12px + var(--safe-top)) 16px 12px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ShoppingCart size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '1px 0 0' }}>
              {pending.length} {pending.length === 1 ? 'item' : 'items'} left · {doneCount} in cart
            </p>
          </div>
          <IconButton label="Close Shop Mode" size={40} onClick={onClose}>
            <X size={18} strokeWidth={2.5} />
          </IconButton>
        </div>
        {/* Progress — aligned to the 16px content margins */}
        <div
          role="progressbar"
          aria-label="Shopping progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          style={{ height: 6, borderRadius: 99, background: 'var(--bg-input)', marginTop: 12, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 260ms var(--ease)' }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px calc(24px + var(--safe-bottom))' }}>
        {allDone ? (
          <div style={{ textAlign: 'center', padding: '40px 24px 24px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-dim)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Check size={32} strokeWidth={2.5} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700 }}>All items in cart</p>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>You're ready to check out.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={finishShopping}>Finish Shopping</button>
          </div>
        ) : (
          groups.map(({ cat, items: gItems }) => (
            <div key={cat?.id ?? '__none'} style={{ marginBottom: 18 }}>
              <p className="shop-cat-label">{cat ? `${cat.emoji} ${cat.name}` : 'Other'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gItems.map(item => (
                  <button
                    key={item.id}
                    className="shop-item"
                    aria-label={`Add ${item.title}${item.quantity ? ` ${formatQuantity(item.quantity)}` : ''} to cart`}
                    onClick={() => addToCart(item)}
                  >
                    <span className="shop-check" aria-hidden />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </span>
                    {item.quantity && (
                      <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{formatQuantity(item.quantity)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* In Cart — collapsible, tap an item to move it back out */}
        {done.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button className="shop-cart-toggle" aria-expanded={cartOpen} onClick={() => setCartOpen(o => !o)}>
              <ShoppingCart size={14} /> In Cart ({done.length})
              <ChevronDown size={15} style={{ marginLeft: 'auto', transform: cartOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms var(--ease)' }} />
            </button>
            {cartOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {done.map(item => (
                  <button
                    key={item.id}
                    className="shop-cart-item"
                    aria-label={`Move ${item.title} back to the list`}
                    onClick={() => removeFromCart(item)}
                  >
                    <span style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={13} strokeWidth={3} color="#fff" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text-2)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </span>
                    {item.quantity && (
                      <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>{formatQuantity(item.quantity)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Undo snackbar */}
      {undo && (
        <div className="shop-snackbar" role="status" aria-live="polite">
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {undo.title} added to cart
          </span>
          <button
            onClick={handleUndo}
            style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', fontSize: 14, fontWeight: 700 }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
