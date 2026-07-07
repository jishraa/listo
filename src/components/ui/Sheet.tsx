import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, ChevronLeft } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  // Optional supporting line under the title (Create List spec §1)
  subtitle?: ReactNode
  // When provided, a header back affordance appears (step navigation, not
  // dismissal). Used for the templates → custom form step.
  onBack?: () => void
  // Accessible name for sheets without a visible title.
  ariaLabel?: string
  // Override stacking when the sheet opens above a full-screen takeover
  // (e.g. Shopping Insights at z-200). Overlay gets this, sheet gets +1.
  zIndex?: number
  children: ReactNode
}

// Stack of open sheets so Escape only closes the topmost one when sheets are
// nested (e.g. Add Item → category picker).
const sheetStack: symbol[] = []

export default function Sheet({ open, onClose, title, subtitle, onBack, ariaLabel, zIndex, children }: SheetProps) {
  // Keep the sheet mounted briefly while it slides back down on close (spec §13).
  const [render, setRender] = useState(open)
  const [closing, setClosing] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (open) {
      setRender(true)
      setClosing(false)
      // Dialog semantics: move keyboard/screen-reader context into the sheet —
      // unless something inside (an autoFocus input) already claimed focus.
      prevFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const t = setTimeout(() => {
        const el = sheetRef.current
        if (el && !el.contains(document.activeElement)) el.focus()
      }, 120)
      return () => clearTimeout(t)
    }
    // Was open, now closing — play the exit, restore focus, then unmount.
    setClosing(true)
    prevFocus.current?.focus()
    const t = setTimeout(() => { setRender(false); setClosing(false) }, 240)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keyboard dialog behavior for the topmost open sheet (a11y §keyboard):
  // Escape closes; Tab cycles inside the sheet instead of escaping to the
  // page behind the overlay.
  useEffect(() => {
    if (!open) return
    const id = Symbol('sheet')
    sheetStack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (sheetStack[sheetStack.length - 1] !== id) return
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const el = sheetRef.current
      if (!el) return
      const focusables = [...el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter(f => !f.hasAttribute('disabled') && f.offsetParent !== null)
      if (focusables.length === 0) { e.preventDefault(); el.focus(); return }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !el.contains(active)) { e.preventDefault(); last.focus() }
      } else if (active === last || !el.contains(active)) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      const i = sheetStack.indexOf(id)
      if (i >= 0) sheetStack.splice(i, 1)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!render) return null

  return (
    <>
      <div
        className={`sheet-overlay${closing ? ' sheet-overlay--closing' : ''}`}
        onClick={onClose}
        style={zIndex !== undefined ? { zIndex } : undefined}
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet${closing ? ' sheet--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? ariaLabel}
        style={{ outline: 'none', ...(zIndex !== undefined ? { zIndex: zIndex + 1 } : {}) }}
      >
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-header">
            {onBack && (
              <button className="btn btn-ghost btn-sm sheet-back" aria-label="Back" onClick={onBack}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="sheet-heading">
              <span className="sheet-title">{title}</span>
              {subtitle && <span className="sheet-subtitle">{subtitle}</span>}
            </div>
            <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
