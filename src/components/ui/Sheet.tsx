import { useEffect, useState, type ReactNode } from 'react'
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
  children: ReactNode
}

export default function Sheet({ open, onClose, title, subtitle, onBack, children }: SheetProps) {
  // Keep the sheet mounted briefly while it slides back down on close (spec §13).
  const [render, setRender] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      setClosing(false)
      return
    }
    // Was open, now closing — play the exit, then unmount.
    setClosing(true)
    const t = setTimeout(() => { setRender(false); setClosing(false) }, 240)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!render) return null

  return (
    <>
      <div className={`sheet-overlay${closing ? ' sheet-overlay--closing' : ''}`} onClick={onClose} />
      <div
        className={`sheet${closing ? ' sheet--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
