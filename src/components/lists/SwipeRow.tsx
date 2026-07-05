import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  onDelete: () => void
  children: ReactNode
  /** Read-only rows (viewers): no swipe-to-delete, no delete panel. */
  disabled?: boolean
}

export function SwipeRow({ onDelete, children, disabled = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rowRef  = useRef<HTMLDivElement>(null)
  const cbsRef  = useRef({ onDelete })
  useEffect(() => { cbsRef.current = { onDelete } }, [onDelete])

  const PEEK = 70
  const TRIGGER = PEEK * 0.4

  const [peeking, setPeeking] = useState(false)
  // Keep the delete panel hidden at rest — it bleeds a red fringe through the
  // antialiased edge of the row otherwise.
  const [engaged, setEngaged] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const dx = useRef(0)
  const locked = useRef<'h' | 'v' | null>(null)
  const fromPeek = useRef(false)

  function setTranslate(x: number, animated = false) {
    const row = rowRef.current
    if (!row) return
    row.style.transition = animated ? 'transform 0.22s ease' : 'none'
    row.style.transform  = `translateX(${x}px)`
  }

  useEffect(() => { setTranslate(peeking ? -PEEK : 0, true) }, [peeking])

  useEffect(() => {
    if (disabled) return
    const wrap = wrapRef.current
    if (!wrap) return

    const onTS = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      locked.current = null; dx.current = 0; fromPeek.current = peeking
    }
    const onTM = (e: TouchEvent) => {
      const adx = Math.abs(e.touches[0].clientX - startX.current)
      const ady = Math.abs(e.touches[0].clientY - startY.current)
      if (!locked.current && (adx > 8 || ady > 8)) locked.current = adx > ady ? 'h' : 'v'
      if (locked.current !== 'h') return
      if (e.cancelable) e.preventDefault()
      setEngaged(true)
      const base = fromPeek.current ? -PEEK : 0
      dx.current = e.touches[0].clientX - startX.current
      setTranslate(Math.max(-PEEK - 40, Math.min(0, base + dx.current)))
    }
    const onTE = () => {
      if (locked.current !== 'h') { locked.current = null; return }
      const final = (fromPeek.current ? -PEEK : 0) + dx.current
      const willPeek = final <= -TRIGGER
      setPeeking(willPeek)
      if (!willPeek) setTimeout(() => setEngaged(false), 240)
    }

    wrap.addEventListener('touchstart', onTS, { passive: true })
    wrap.addEventListener('touchmove',  onTM, { passive: false })
    wrap.addEventListener('touchend',   onTE, { passive: true })
    return () => {
      wrap.removeEventListener('touchstart', onTS)
      wrap.removeEventListener('touchmove',  onTM)
      wrap.removeEventListener('touchend',   onTE)
    }
  }, [peeking, disabled])

  if (disabled) return <div style={{ position: 'relative' }}>{children}</div>

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: PEEK,
        display: 'flex', alignItems: 'stretch',
        pointerEvents: peeking ? 'auto' : 'none',
        visibility: engaged || peeking ? 'visible' : 'hidden',
      }}>
        <button
          onClick={() => { setPeeking(false); setTimeout(() => setEngaged(false), 240); cbsRef.current.onDelete() }}
          style={{
            flex: 1, border: 'none', cursor: 'pointer',
            background: '#ef4444', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 4,
          }}
        >
          <Trash2 size={16} strokeWidth={2.4} />
          <span style={{ fontSize: 10, fontWeight: 700 }}>Delete</span>
        </button>
      </div>
      <div ref={rowRef} onClick={() => { if (peeking) { setPeeking(false); setTimeout(() => setEngaged(false), 240) } }}
        style={{
          // Opaque base under the translucent glass surface, otherwise the
          // red delete panel behind bleeds through the row's edge at rest.
          backgroundColor: 'var(--bg)',
          backgroundImage: 'linear-gradient(var(--bg-card), var(--bg-card))',
          willChange: 'transform', transition: 'transform 0.22s ease',
        }}>
        {children}
      </div>
    </div>
  )
}
