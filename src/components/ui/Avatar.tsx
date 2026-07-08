import type { CSSProperties } from 'react'

// Deterministic identity hue from a display name — the same person gets the
// same color on every surface (member rows, avatar stacks).
export const avatarHue = (name: string) => ((name.charCodeAt(0) || 0) * 47) % 360

interface AvatarProps {
  name: string
  size?: number
  /** HSL tuning — the compact ListDetail stack runs brighter than rows. */
  saturation?: number
  lightness?: number
  style?: CSSProperties
}

export default function Avatar({ name, size = 38, saturation = 45, lightness = 38, style }: AvatarProps) {
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${avatarHue(name)}deg, ${saturation}%, ${lightness}%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 700, color: '#fff' }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
