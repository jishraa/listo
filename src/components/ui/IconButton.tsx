import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — icon-only buttons are invisible to AT without one. */
  label: string
  size?: number
  children: ReactNode
}

// Circular icon-only button with a mandatory accessible name. Use for
// close/dismiss/utility icons outside of Sheet headers (which bring their
// own); pass `style` to adjust background or placement.
export default function IconButton({ label, size = 40, children, style, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      {...rest}
      style={{
        width: size, height: size, borderRadius: 99, flexShrink: 0,
        background: 'var(--bg-input)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-2)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
