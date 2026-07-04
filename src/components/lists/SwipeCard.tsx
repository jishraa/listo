import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface SwipeAction {
  label: string
  icon: ReactNode
  color: string
  onPress: () => void
}

interface Props {
  // Revealed by swiping right (anchored left) — e.g. Pin / Share
  leftActions?: SwipeAction[]
  // Revealed by swiping left (anchored right) — e.g. Archive / Delete
  rightActions?: SwipeAction[]
  children: ReactNode
}

const BTN_W = 68

// Bidirectional swipe for list cards (lists spec v3 §11). Same axis-lock
// approach as SwipeRow, extended to two action groups. Tapping the card
// while revealed just closes it.
export function SwipeCard({ leftActions = [], rightActions = [], children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rowRef  = useRef<HTMLDivElement>(null)

  const leftW  = leftActions.length * BTN_W
  const rightW = rightActions.length * BTN_W

  // -1 = right actions revealed, 1 = left actions revealed, 0 = closed
  const [state, setState] = useState<-1 | 0 | 1>(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const dx = useRef(0)
  const locked = useRef<'h' | 'v' | null>(null)
  const baseRef = useRef(0)

  function setTranslate(x: number, animated = false) {
    const row = rowRef.current
    if (!row) return
    row.style.transition = animated ? 'transform 0.22s ease' : 'none'
    row.style.transform  = `translateX(${x}px)`
    // A lingering transform would re-anchor position:fixed children (the
    // card's menu sheet), so drop it entirely once the card settles closed.
    if (x === 0 && animated) {
      setTimeout(() => {
        const r = rowRef.current
        if (r && r.style.transform === 'translateX(0px)') r.style.transform = ''
      }, 240)
    }
  }

  useEffect(() => {
    setTranslate(state === 1 ? leftW : state === -1 ? -rightW : 0, true)
  }, [state, leftW, rightW])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const onTS = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      locked.current = null; dx.current = 0
      baseRef.current = state === 1 ? leftW : state === -1 ? -rightW : 0
    }
    const onTM = (e: TouchEvent) => {
      const adx = Math.abs(e.touches[0].clientX - startX.current)
      const ady = Math.abs(e.touches[0].clientY - startY.current)
      if (!locked.current && (adx > 8 || ady > 8)) locked.current = adx > ady ? 'h' : 'v'
      if (locked.current !== 'h') return
      if (e.cancelable) e.preventDefault()
      dx.current = e.touches[0].clientX - startX.current
      const next = Math.max(-rightW - 30, Math.min(leftW + 30, baseRef.current + dx.current))
      setTranslate(next)
    }
    const onTE = () => {
      if (locked.current !== 'h') { locked.current = null; return }
      const final = baseRef.current + dx.current
      if (final > leftW * 0.4 && leftW > 0) setState(1)
      else if (final < -rightW * 0.4 && rightW > 0) setState(-1)
      else { setState(0); setTranslate(0, true) }
    }

    wrap.addEventListener('touchstart', onTS, { passive: true })
    wrap.addEventListener('touchmove',  onTM, { passive: false })
    wrap.addEventListener('touchend',   onTE, { passive: true })
    return () => {
      wrap.removeEventListener('touchstart', onTS)
      wrap.removeEventListener('touchmove',  onTM)
      wrap.removeEventListener('touchend',   onTE)
    }
  }, [state, leftW, rightW])

  const actionBtn = (a: SwipeAction) => (
    <button
      key={a.label}
      onClick={() => { setState(0); a.onPress() }}
      style={{
        width: BTN_W, border: 'none', cursor: 'pointer',
        background: a.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 4,
      }}
    >
      {a.icon}
      <span style={{ fontSize: 10, fontWeight: 700 }}>{a.label}</span>
    </button>
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
      {leftActions.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: leftW,
          display: 'flex', alignItems: 'stretch',
          pointerEvents: state === 1 ? 'auto' : 'none',
        }}>
          {leftActions.map(actionBtn)}
        </div>
      )}
      {rightActions.length > 0 && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: rightW,
          display: 'flex', alignItems: 'stretch',
          pointerEvents: state === -1 ? 'auto' : 'none',
        }}>
          {rightActions.map(actionBtn)}
        </div>
      )}
      <div
        ref={rowRef}
        onClickCapture={e => {
          // First tap on a revealed card closes it instead of opening the list
          if (state !== 0) { e.stopPropagation(); e.preventDefault(); setState(0) }
        }}
        style={{ willChange: 'transform', transition: 'transform 0.22s ease' }}
      >
        {children}
      </div>
    </div>
  )
}
