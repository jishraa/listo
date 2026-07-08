import type { ReactNode } from 'react'
import Sheet from './Sheet'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  /** Dialog accessible name + heading line. */
  title: string
  /** Supporting copy under the title. */
  children?: ReactNode
  /** Optional leading icon — renders the centered variant. */
  icon?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Destructive styling on the confirm button (default: true). */
  danger?: boolean
  /** Shows a spinner and blocks dismissal while the action runs. */
  busy?: boolean
  error?: string | null
  onConfirm: () => void | Promise<void>
}

// The one way to confirm an action from a bottom sheet. Replaces the
// hand-built confirm sheets that used to live in Lists, ListDetail, Profile
// and Account — destructive actions are always confirmed (UX review §19),
// and they should all look and behave identically.
export default function ConfirmSheet({
  open, onClose, title, children, icon, confirmLabel,
  cancelLabel = 'Cancel', danger = true, busy = false, error, onConfirm,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={() => { if (!busy) onClose() }} ariaLabel={title}>
      <div className="sheet-body" style={{ gap: 12, textAlign: icon ? 'center' : 'left' }}>
        {icon && (
          <div aria-hidden style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 -2px' }}>
            {icon}
          </div>
        )}
        <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</p>
        {children && (
          <div className="text-muted text-sm" style={{ lineHeight: 1.5 }}>{children}</div>
        )}
        {error && <div className="error-msg" role="alert" style={{ textAlign: 'left' }}>{error}</div>}
        <div className="flex gap-2" style={{ marginTop: 4 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ flex: 1 }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
