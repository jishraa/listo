export function generateInviteCode(): string {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(36)).join('').slice(0, 8)
}

// Contextual labels (lists spec v3 §9): minutes only for recent activity,
// then calendar-based Today / Yesterday / N days ago.
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (dayDiff === 0) return 'today'
  if (dayDiff === 1) return 'yesterday'
  if (dayDiff < 7) return `${dayDiff} days ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Normalise item titles for display: "rice" → "Rice".
export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Humanise technical usernames for display: "anjana1995ks" / "anjana@x.com"
// → "Anjana". Real display names (with spaces / no digits) pass through.
export function friendlyName(name: string): string {
  const base = name.split('@')[0].trim()
  if (!/[0-9_.-]/.test(base)) {
    // Already a human name — just ensure the first letter is capitalised.
    return base.charAt(0).toUpperCase() + base.slice(1)
  }
  const alpha = base.match(/^[a-zA-Z]+/)?.[0] ?? ''
  if (alpha.length < 2) return name
  return alpha.charAt(0).toUpperCase() + alpha.slice(1)
}

export const LIST_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal',
  tasks: 'Tasks',
  shopping: 'Shopping',
}

export const LIST_TYPE_EMOJIS: Record<string, string> = {
  personal: '📋',
  tasks: '✅',
  shopping: '🛒',
}
