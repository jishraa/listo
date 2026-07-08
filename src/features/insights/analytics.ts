import type { ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'

// Pure analytics behind Shopping Insights — no store, no React. Every
// function takes plain data so the prediction/score/trend logic can be
// regression-tested with known inputs (QE framework §13).

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function scoreLabel(score: number): { label: string; sub: string } {
  if (score >= 90) return { label: 'Excellent Planner', sub: 'Your shopping game is on point.' }
  if (score >= 75) return { label: 'Good Planner', sub: "You're shopping efficiently." }
  if (score >= 60) return { label: 'Fair', sub: 'A few tweaks will go a long way.' }
  if (score >= 40) return { label: 'Getting Started', sub: 'Keep completing lists to improve.' }
  return { label: 'Needs Improvement', sub: "Let's tidy up this list." }
}

/** Titles appearing more than once (any status) — the Insights dupe metric. */
export function duplicateTitleCount(items: ListItem[]): number {
  const seen = new Map<string, number>()
  items.forEach(i => {
    const k = i.title.trim().toLowerCase()
    seen.set(k, (seen.get(k) ?? 0) + 1)
  })
  return [...seen.values()].filter(n => n > 1).length
}

/** Items left pending in archived shopping lists — bought runs that ended
 *  with items never checked off. */
export function forgottenCount(archivedShoppingListIds: string[], itemsByList: Record<string, ListItem[]>): number {
  return archivedShoppingListIds.reduce((n, id) => n + (itemsByList[id] ?? []).filter(i => !i.completed).length, 0)
}

export interface HealthInput {
  pct: number; catPct: number; dupeCount: number; forgotten: number
  pending: number; uncat: number
}

/** Shopping Health: score /100, headroom, and the check/warn list. */
export function computeHealth({ pct, catPct, dupeCount, forgotten, pending, uncat }: HealthInput) {
  const score = Math.min(100, Math.round(pct * 0.55 + catPct * 0.25 + (dupeCount === 0 ? 10 : 0) + (forgotten === 0 ? 10 : 0)))
  const potential = Math.min(100 - score,
    (pending > 0 ? Math.round(0.55 * (100 - pct)) : 0)
    + (uncat > 0 ? Math.round(0.25 * (100 - catPct)) : 0)
    + (dupeCount > 0 ? 10 : 0))
  const checklist: { ok: boolean; text: string }[] = [
    pct >= 80 ? { ok: true, text: `High completion rate (${pct}%)` } : { ok: false, text: `Completion at ${pct}%` },
    dupeCount === 0 ? { ok: true, text: 'No duplicate items' } : { ok: false, text: `${dupeCount} duplicate ${dupeCount === 1 ? 'item' : 'items'}` },
    catPct >= 80 ? { ok: true, text: 'Most items are categorized' } : { ok: false, text: `${uncat} ${uncat === 1 ? 'item' : 'items'} uncategorized` },
    pending > 0 ? { ok: false, text: `${pending} ${pending === 1 ? 'item' : 'items'} still pending` } : { ok: true, text: 'All items completed' },
  ]
  return { score, potential, checklist }
}

/** Most-active weekday + average list size across shopping lists. */
export function computeBehaviour(shoppingListIds: string[], itemsByList: Record<string, ListItem[]>) {
  const dayCounts = new Array(7).fill(0) as number[]
  let listCount = 0
  let itemSum = 0
  for (const id of shoppingListIds) {
    const its = itemsByList[id] ?? []
    if (its.length === 0) continue
    listCount++
    itemSum += its.length
    for (const i of its) {
      const at = i.completed_at ?? (i.completed ? i.created_at : null)
      if (at) dayCounts[new Date(at).getDay()]++
    }
  }
  const max = Math.max(...dayCounts)
  return {
    day: max > 0 ? WEEKDAYS[dayCounts.indexOf(max)] : null,
    avg: listCount > 0 ? Math.round(itemSum / listCount) : 0,
    listCount,
  }
}

export type CatStat = ListCategory & { total: number; done: number }

/** Per-category totals for the current list, largest first. */
export function computeCatStats(cats: ListCategory[], items: ListItem[]): CatStat[] {
  return cats.map(c => {
    const catItems = items.filter(i => i.category === c.id)
    return { ...c, total: catItems.length, done: catItems.filter(i => i.completed).length }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
}

/** Variety note — only when it says something meaningful. */
export function varietyInsight(catStats: CatStat[], total: number): { text: string; sub: string } | null {
  if (catStats.length < 3 || total < 8) return null
  const top = catStats[0]
  const share = Math.round((top.total / total) * 100)
  if (share > 50) return { text: `${top.emoji} ${top.name} makes up ${share}% of your list.`, sub: 'One category dominates — worth double-checking the rest.' }
  if (share >= 25) return { text: `${top.emoji} ${top.name} makes up ${share}% of your list.`, sub: 'Your categories are well balanced.' }
  return null
}

/** Category share vs the average of previous lists (±3pt noise clamped to 0). */
export function computeTrends(
  otherListIds: string[], itemsByList: Record<string, ListItem[]>, catStats: CatStat[], total: number,
): { id: string; name: string; color: string; diff: number }[] {
  if (otherListIds.length === 0 || catStats.length === 0) return []
  const avgShare = new Map<string, number>()
  for (const c of catStats) {
    let sum = 0
    for (const id of otherListIds) {
      const its = itemsByList[id] ?? []
      sum += (its.filter(i => i.category === c.id).length / its.length) * 100
    }
    avgShare.set(c.id, sum / otherListIds.length)
  }
  return catStats.map(c => {
    const thisShare = (c.total / total) * 100
    const diff = Math.round(thisShare - (avgShare.get(c.id) ?? 0))
    return { id: c.id, name: c.name, color: c.color, diff: Math.abs(diff) < 3 ? 0 : diff }
  })
}

export interface Candidate { key: string; title: string; category: string | null; count: number }

/** Predicted next list: items bought 2+ times across shopping lists that
 *  aren't already pending here, plus a confidence heuristic. */
export function computeCandidates(
  shoppingListIds: string[], itemsByList: Record<string, ListItem[]>, currentItems: ListItem[],
): { candidates: Candidate[]; confidence: number } {
  const freq = new Map<string, { title: string; category: string | null; count: number }>()
  for (const id of shoppingListIds) {
    for (const i of itemsByList[id] ?? []) {
      const k = i.title.trim().toLowerCase()
      if (!k) continue
      const e = freq.get(k)
      if (e) { e.count++; if (!e.category && i.category) e.category = i.category }
      else freq.set(k, { title: cap(i.title.trim()), category: i.category, count: 1 })
    }
  }
  const pendingHere = new Set(currentItems.filter(i => !i.completed).map(i => i.title.trim().toLowerCase()))
  const candidates = [...freq.entries()]
    .filter(([k, v]) => v.count >= 2 && !pendingHere.has(k))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([k, v]) => ({ key: k, ...v }))
  const uniq = freq.size
  const repeated = [...freq.values()].filter(v => v.count >= 2).length
  const confidence = uniq > 0 ? Math.min(95, Math.max(20, Math.round((repeated / uniq) * 100))) : 0
  return { candidates, confidence }
}

/** Top adder / completer for shared lists; null when there's nothing to say. */
export function memberActivity(items: ListItem[], memberCount: number) {
  if (memberCount < 2) return null
  const added: Record<string, number> = {}
  const completed: Record<string, number> = {}
  items.forEach(i => {
    if (i.added_by_name) added[i.added_by_name] = (added[i.added_by_name] || 0) + 1
    if (i.completed && i.completed_by_name) completed[i.completed_by_name] = (completed[i.completed_by_name] || 0) + 1
  })
  const topAdder = Object.entries(added).sort((a, b) => b[1] - a[1])[0]
  const topCompleter = Object.entries(completed).sort((a, b) => b[1] - a[1])[0]
  if (!topAdder && !topCompleter) return null
  return { topAdder, topCompleter }
}
