import type { ListItem } from '../types'

// Duplicate detection, centralized and pure so it can be unit-tested and reused
// consistently (List Memory, Before You Go, Next List).
//
// Core rule:
//   Pending match   → potential duplicate → Review / Merge
//   Completed match → repeat purchase     → add as a new pending item
//
// A completed item is a past shopping action; it must never block or merge with
// a new requirement, and its history must be preserved untouched.

export const normalizeTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ')

// Blocking duplicate groups — computed ONLY over pending items. Completed items
// are excluded so a previously-purchased item never re-opens the review sheet.
// Returns same-name groups of 2+ pending items, keyed by normalized title.
export function pendingDuplicateGroups(items: ListItem[]): Map<string, ListItem[]> {
  const groups = new Map<string, ListItem[]>()
  for (const i of items) {
    if (i.completed) continue
    const key = normalizeTitle(i.title)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i)
  }
  const result = new Map<string, ListItem[]>()
  groups.forEach((g, k) => { if (g.length > 1) result.set(k, g) })
  return result
}

// A completed item with the same name exists → this add is a repeat purchase.
// Used only for non-blocking context ("previously purchased"), never to block.
export function hasCompletedMatch(items: ListItem[], title: string): boolean {
  const key = normalizeTitle(title)
  return items.some(i => i.completed && normalizeTitle(i.title) === key)
}

// The pending item to offer a quantity merge against: same name AND already has
// a quantity (scenario 2). Completed items are excluded. When the existing
// pending item has no quantity (scenario 3), there's no auto-merge target — it
// falls through to the ambiguous review path instead.
export function findPendingMergeTarget(items: ListItem[], title: string): ListItem | null {
  const key = normalizeTitle(title)
  return items.find(i => !i.completed && normalizeTitle(i.title) === key && !!i.quantity) ?? null
}

// ── Quantity-aware group analysis (used by the Review Duplicates sheet) ──────

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// Parse a stored quantity string. "×2" → a count; "2kg" → a unit quantity;
// null/empty → no quantity. We never invent a unit that isn't there.
export function parseQty(q: string | null | undefined): { count: boolean; num: number; unit: string } | null {
  if (!q) return null
  const m = q.trim().replace(/\s+/g, '').match(/^([×x])?(\d+(?:\.\d+)?)([a-zA-Z]*)$/)
  if (!m) return null
  const unit = m[3].toLowerCase()
  return { count: !!m[1] || !unit, num: parseFloat(m[2]), unit }
}

export type DupeKind = 'exact' | 'mergeable' | 'ambiguous'
export interface DupePlan { kind: DupeKind; merged: string | null; mergeLabel: string; suggestMerge: boolean }

// Decide what to suggest for a group of same-named pending items.
export function analyzeGroup(group: ListItem[]): DupePlan {
  const parsed = group.map(i => parseQty(i.quantity))
  if (parsed.every(p => p === null)) {
    // Milk + Milk → plain duplicate, remove the extras.
    return { kind: 'exact', merged: null, mergeLabel: 'Remove Duplicate', suggestMerge: true }
  }
  if (parsed.every(p => p !== null)) {
    const ps = parsed as { count: boolean; num: number; unit: string }[]
    const allCount = ps.every(p => p.count && !p.unit)
    const unit0 = ps[0].unit
    const allSameUnit = !!unit0 && ps.every(p => !p.count && p.unit === unit0)
    if (allCount || allSameUnit) {
      // ×2 + ×3 → ×5, or 2kg + 5kg → 7kg
      const sum = ps.reduce((a, p) => a + p.num, 0)
      const merged = allCount ? `×${fmtNum(sum)}` : `${fmtNum(sum)}${unit0}`
      return { kind: 'mergeable', merged, mergeLabel: `Merge to ${merged}`, suggestMerge: true }
    }
  }
  // Rice + Rice 5kg, or incompatible units → let the user decide; keep the one
  // present quantity rather than inventing anything.
  const firstQty = group.find(i => i.quantity)?.quantity ?? null
  return { kind: 'ambiguous', merged: firstQty, mergeLabel: 'Merge Items', suggestMerge: false }
}
