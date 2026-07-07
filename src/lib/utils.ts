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

// Centralized quantity display: normalize the stored qty ("2L", "5kg", "×10",
// "1kg", "500g") to a consistent "<number> <unit>" form — "2 L", "5 kg", "10",
// "1 kg", "500 g". The × count symbol is dropped (shows the bare number).
// Anything that doesn't match (e.g. a merged "3+2") is returned unchanged.
export function formatQuantity(qty: string | null | undefined): string {
  if (!qty) return ''
  const m = String(qty).trim().match(/^×?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/)
  if (!m) return String(qty).trim()
  return m[2] ? `${m[1]} ${m[2]}` : m[1]
}

// Humanise technical usernames for display: "anjana1995ks" / "anjana@x.com"
// → "Anjana". Only digits/underscores mark a name as technical — hyphens and
// dots are name-ish, so "Mary-Jane" / "J.Doe" stay whole (just capitalised).
export function friendlyName(name: string): string {
  const base = name.split('@')[0].trim()
  if (base.includes(' ') || !/[0-9_]/.test(base)) {
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : name
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
