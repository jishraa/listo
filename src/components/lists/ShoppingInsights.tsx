import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, FileText, Plus, Sparkles, X } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { useListsStore, visibleLists, archivedLists } from '../../store/useListsStore'
import { useCategoriesStore } from '../../store/useCategoriesStore'
import { exportListReport, exportListCsv } from '../../lib/report'
import { openYft } from '../../lib/yft'
import { friendlyName } from '../../lib/utils'
import type { List, ListItem, ListMember } from '../../types'

// Shopping Insights (redesign spec): answers four questions — how did I do,
// what are my habits, what can I improve, what should I do next. Every
// section either explains something or offers an action; sections with
// insufficient data stay hidden rather than rendering empty analytics.

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px',
}
const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 14, padding: '14px 16px',
}

function scoreLabel(score: number): { label: string; sub: string } {
  if (score >= 90) return { label: 'Excellent Planner', sub: 'Your shopping game is on point.' }
  if (score >= 75) return { label: 'Good Planner', sub: "You're shopping efficiently." }
  if (score >= 60) return { label: 'Fair', sub: 'A few tweaks will go a long way.' }
  if (score >= 40) return { label: 'Getting Started', sub: 'Keep completing lists to improve.' }
  return { label: 'Needs Improvement', sub: "Let's tidy up this list." }
}

interface Props {
  list: List
  items: ListItem[]
  members: ListMember[]
  displayName: string
  onClose: () => void
  onCategorize: () => void
  onReviewDuplicates: () => void
}

export default function ShoppingInsights({ list, items, members, displayName, onClose, onCategorize, onReviewDuplicates }: Props) {
  const store = useListsStore()
  const navigate = useNavigate()
  const allCategories = useCategoriesStore(s => s.categories)
  const cats = allCategories[list.type] ?? []
  const recsRef = useRef<HTMLDivElement>(null)

  const [showAllCats, setShowAllCats] = useState(false)
  const [deselected, setDeselected] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdList, setCreatedList] = useState<List | null>(null)
  const [tplPreview, setTplPreview] = useState(false)
  const [tplCreated, setTplCreated] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf')
  const [exporting, setExporting] = useState(false)

  // ── Core numbers ────────────────────────────────────────────
  const total = items.length
  const done = items.filter(i => i.completed).length
  const pending = total - done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const dupeCount = useMemo(() => {
    const seen = new Map<string, number>()
    items.forEach(i => {
      const k = i.title.trim().toLowerCase()
      seen.set(k, (seen.get(k) ?? 0) + 1)
    })
    return [...seen.values()].filter(n => n > 1).length
  }, [items])

  // Orphaned ids (category since deleted) are uncategorized for scoring too.
  const uncat = items.filter(i => !i.category || !cats.some(c => c.id === i.category)).length
  const catPct = total > 0 ? Math.round(((total - uncat) / total) * 100) : 0

  // ── History across the user's shopping lists ────────────────
  const shoppingLists = useMemo(
    () => visibleLists(store.lists).filter(l => l.type === 'shopping'),
    [store.lists],
  )
  const otherLists = useMemo(
    () => shoppingLists.filter(l => l.id !== list.id && (store.items[l.id]?.length ?? 0) > 0),
    [shoppingLists, list.id, store.items],
  )

  // Forgotten = items left pending in archived shopping lists — bought lists
  // that ended with items never checked off.
  const forgotten = useMemo(() =>
    archivedLists(store.lists)
      .filter(l => l.type === 'shopping')
      .reduce((n, l) => n + (store.items[l.id] ?? []).filter(i => !i.completed).length, 0),
  [store.lists, store.items])

  // ── Shopping Health score ───────────────────────────────────
  const score = Math.min(100, Math.round(pct * 0.55 + catPct * 0.25 + (dupeCount === 0 ? 10 : 0) + (forgotten === 0 ? 10 : 0)))
  const { label: scoreTitle, sub: scoreSub } = scoreLabel(score)
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

  // ── Behaviour ───────────────────────────────────────────────
  const behaviour = useMemo(() => {
    const dayCounts = new Array(7).fill(0) as number[]
    let listCount = 0
    let itemSum = 0
    for (const l of shoppingLists) {
      const its = store.items[l.id] ?? []
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
  }, [shoppingLists, store.items])

  // ── Category analysis ───────────────────────────────────────
  const catStats = useMemo(() => {
    const rows = cats.map(c => {
      const catItems = items.filter(i => i.category === c.id)
      return { ...c, total: catItems.length, done: catItems.filter(i => i.completed).length }
    }).filter(c => c.total > 0)
    return rows.sort((a, b) => b.total - a.total)
  }, [cats, items])
  const visibleCatStats = showAllCats ? catStats : catStats.slice(0, 5)

  // Variety — only shown when it says something meaningful
  const variety = useMemo(() => {
    if (catStats.length < 3 || total < 8) return null
    const top = catStats[0]
    const share = Math.round((top.total / total) * 100)
    if (share > 50) return { text: `${top.emoji} ${top.name} makes up ${share}% of your list.`, sub: 'One category dominates — worth double-checking the rest.' }
    if (share >= 25) return { text: `${top.emoji} ${top.name} makes up ${share}% of your list.`, sub: 'Your categories are well balanced.' }
    return null
  }, [catStats, total])

  // ── Trends vs previous lists ────────────────────────────────
  const trends = useMemo(() => {
    if (otherLists.length === 0 || catStats.length === 0) return []
    const avgShare = new Map<string, number>()
    for (const c of catStats) {
      let sum = 0
      for (const l of otherLists) {
        const its = store.items[l.id] ?? []
        sum += (its.filter(i => i.category === c.id).length / its.length) * 100
      }
      avgShare.set(c.id, sum / otherLists.length)
    }
    return catStats.map(c => {
      const thisShare = (c.total / total) * 100
      const diff = Math.round(thisShare - (avgShare.get(c.id) ?? 0))
      return { id: c.id, name: c.name, color: c.color, diff: Math.abs(diff) < 3 ? 0 : diff }
    })
  }, [otherLists, catStats, store.items, total])

  // ── Prediction from purchase frequency ──────────────────────
  const { candidates, confidence } = useMemo(() => {
    const freq = new Map<string, { title: string; category: string | null; count: number }>()
    for (const l of shoppingLists) {
      for (const i of store.items[l.id] ?? []) {
        const k = i.title.trim().toLowerCase()
        if (!k) continue
        const e = freq.get(k)
        if (e) { e.count++; if (!e.category && i.category) e.category = i.category }
        else freq.set(k, { title: cap(i.title.trim()), category: i.category, count: 1 })
      }
    }
    const pendingHere = new Set(items.filter(i => !i.completed).map(i => i.title.trim().toLowerCase()))
    const cands = [...freq.entries()]
      .filter(([k, v]) => v.count >= 2 && !pendingHere.has(k))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([k, v]) => ({ key: k, ...v }))
    const uniq = freq.size
    const repeated = [...freq.values()].filter(v => v.count >= 2).length
    const conf = uniq > 0 ? Math.min(95, Math.max(20, Math.round((repeated / uniq) * 100))) : 0
    return { candidates: cands, confidence: conf }
  }, [shoppingLists, store.items, items])
  const selectedCands = candidates.filter(c => !deselected.has(c.key))

  // ── Suggested template ──────────────────────────────────────
  const tplItems = candidates.slice(0, 10)
  const hasTemplateSuggestion = tplItems.length >= 5 && !tplCreated

  async function handleCreateTemplate() {
    await store.createTemplate('Essential Groceries', '🛒', tplItems.map(t => ({ title: t.title, category: t.category })))
    setTplCreated(true)
  }

  async function handleCreateList() {
    if (creating || selectedCands.length === 0) return
    setCreating(true)
    const name = createName.trim() || 'Next Shopping List'
    const created = await store.createList({ name, type: 'shopping', emoji: '🛒' })
    if (created) {
      for (const c of selectedCands) await store.addItem(created.id, c.title, '', c.category)
      setCreatedList(created)
    }
    setCreating(false)
  }

  function openCreateSheet() {
    const next = new Date()
    next.setMonth(next.getMonth() + 1)
    setCreateName(`${next.toLocaleDateString(undefined, { month: 'long' })} Groceries`)
    setCreatedList(null)
    setCreateOpen(true)
  }

  // ── Top recommendations (max 3, most valuable first) ────────
  const recommendations = useMemo(() => {
    const recs: { title: string; desc: string; btn: string; action: () => void }[] = []
    if (uncat > 0) recs.push({ title: `Categorize ${uncat} ${uncat === 1 ? 'item' : 'items'}`, desc: 'Improve future insights and predictions.', btn: 'Categorize', action: onCategorize })
    if (dupeCount > 0) recs.push({ title: `Resolve ${dupeCount} duplicate ${dupeCount === 1 ? 'item' : 'items'}`, desc: 'Merge or remove repeated items.', btn: 'Review', action: onReviewDuplicates })
    if (hasTemplateSuggestion) recs.push({ title: 'Save Essential Groceries', desc: 'Reuse your frequently purchased items.', btn: 'Create Template', action: handleCreateTemplate })
    if (candidates.length >= 3) recs.push({ title: 'Prepare your next shopping list', desc: `${selectedCands.length} frequently purchased items are ready.`, btn: 'Create List', action: openCreateSheet })
    return recs.slice(0, 3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uncat, dupeCount, hasTemplateSuggestion, candidates.length, selectedCands.length])

  // ── Member activity (shared lists only) ─────────────────────
  const memberStats = useMemo(() => {
    if (members.length < 2) return null
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
  }, [members.length, items])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      if (exportFormat === 'pdf') await exportListReport(list, items, members)
      else await exportListCsv(list, items, members)
    } finally {
      setExporting(false)
      setExportOpen(false)
    }
  }

  const person = (n: string) => (n === displayName ? 'You' : friendlyName(n))
  const insufficient = total === 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      animation: 'slide-up 0.3s var(--ease)',
    }}>
      {/* Sticky header — content scrolls below it, never behind it */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        background: 'var(--bg)',
      }}>
        <button onClick={onClose} aria-label="Back to list"
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>Insights</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.emoji} {list.name}</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {insufficient ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Not enough shopping history yet</p>
            <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 8, lineHeight: 1.55 }}>
              Complete a few shopping lists and Listo will start showing trends, predictions, and recommendations.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Back to List</button>
          </div>
        ) : (
          <>
            {/* ── Shopping Health ── */}
            <div style={card}>
              <p style={sectionLabel}>Shopping Health</p>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <p style={{ fontSize: 34, fontWeight: 800, color: 'var(--accent)', margin: 0, lineHeight: 1 }}>{score}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>/100</p>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{scoreTitle}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '2px 0 10px' }}>{scoreSub}</p>
                  <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${score}%`, background: 'var(--accent)', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {checklist.map((c, i) => (
                      <span key={i} style={{ fontSize: 13, color: c.ok ? 'var(--text-2)' : '#d97706', display: 'flex', gap: 7 }}>
                        <span style={{ color: c.ok ? 'var(--accent)' : '#d97706', flexShrink: 0, fontWeight: 700 }}>{c.ok ? '✓' : '⚠'}</span>
                        {c.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {potential > 0 && (
                <button
                  onClick={() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 14, paddingTop: 12, background: 'none', cursor: 'pointer',
                    border: 'none', borderTop: '1px solid var(--border)',
                  }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Potential improvement</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    +{potential} points <ChevronRight size={14} />
                  </span>
                </button>
              )}
            </div>

            {/* ── Shopping Efficiency ── */}
            <div>
              <p style={sectionLabel}>Shopping Efficiency</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { value: `${pct}%`, label: 'Completion', sub: `${done} of ${total} items`, color: 'var(--accent)', onTap: undefined },
                  { value: String(pending), label: 'Pending', sub: pending > 0 ? 'Items remaining' : 'Nothing left', color: pending > 0 ? '#d97706' : 'var(--text-3)', onTap: pending > 0 ? onClose : undefined },
                  { value: String(forgotten), label: 'Forgotten', sub: forgotten > 0 ? 'From past lists' : 'None missed', color: forgotten > 0 ? '#d97706' : 'var(--text-3)', onTap: undefined },
                  { value: String(dupeCount), label: 'Duplicates', sub: dupeCount > 0 ? 'Tap to review' : 'No duplicates', color: dupeCount > 0 ? '#d97706' : 'var(--text-3)', onTap: dupeCount > 0 ? onReviewDuplicates : undefined },
                ].map(m => (
                  <button key={m.label} onClick={m.onTap} disabled={!m.onTap}
                    style={{
                      ...card, textAlign: 'left', cursor: m.onTap ? 'pointer' : 'default', padding: '13px 15px',
                    }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: m.color, margin: 0 }}>{m.value}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '3px 0 0' }}>{m.label}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0' }}>{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Shopping Behaviour ── */}
            {behaviour.listCount >= 2 && behaviour.day && (
              <div>
                <p style={sectionLabel}>Shopping Behaviour</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ ...card, padding: '13px 15px' }}>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📅 {behaviour.day}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>Most Active Day</p>
                  </div>
                  <div style={{ ...card, padding: '13px 15px' }}>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📦 {behaviour.avg}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>Avg Items per List</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Category Analysis ── */}
            {catStats.length > 0 && (
              <div>
                <p style={sectionLabel}>Category Analysis</p>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {visibleCatStats.map(c => {
                    const share = Math.round((c.total / total) * 100)
                    const p = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{c.emoji} {c.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{share}%</span>
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 5px' }}>{c.total} {c.total === 1 ? 'item' : 'items'} · {c.done} completed</p>
                        <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${p}%`, background: c.color, opacity: 0.85, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {catStats.length > 5 && !showAllCats && (
                    <button onClick={() => setShowAllCats(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', padding: '2px 0' }}>
                      Show {catStats.length - 5} More ↓
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Uncategorized items ── */}
            {uncat > 0 && (
              <div style={card}>
                <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 4px' }}>
                  {uncat} {uncat === 1 ? 'item needs a category' : 'items need categories'}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Categorizing your items improves future recommendations and shopping reports.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  {['Better insights', 'Smarter recommendations', 'Automatic templates'].map(b => (
                    <span key={b} style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>  {b}
                    </span>
                  ))}
                </div>
                <button className="btn btn-primary btn-full" onClick={onCategorize}>Categorize Items</button>
              </div>
            )}

            {/* ── Variety (only when meaningful) ── */}
            {variety && (
              <div style={{ ...card, padding: '12px 16px' }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>📊 {variety.text}</p>
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '3px 0 0' }}>{variety.sub}</p>
              </div>
            )}

            {/* ── Shopping Trends ── */}
            {trends.length > 0 && (
              <div>
                <p style={sectionLabel}>Shopping Trends</p>
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Compared with your previous lists</p>
                  {trends.map(t => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span style={{ fontSize: 13.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                        {t.name}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: t.diff === 0 ? 'var(--text-3)' : t.diff > 0 ? 'var(--accent)' : '#d97706',
                      }}>
                        {t.diff === 0 ? '—' : t.diff > 0 ? `▲ ${t.diff}%` : `▼ ${Math.abs(t.diff)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Predicted next list ── */}
            {candidates.length >= 3 && (
              <div>
                <p style={sectionLabel}>Predicted Next List</p>
                <div style={card}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 2px', fontWeight: 600 }}>
                    <Sparkles size={12} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />
                    Smart Prediction · {confidence}% confidence
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>Based on your frequently purchased items. Tap to include or exclude.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {candidates.map(c => {
                      const on = !deselected.has(c.key)
                      return (
                        <button key={c.key}
                          onClick={() => setDeselected(prev => {
                            const next = new Set(prev)
                            if (next.has(c.key)) next.delete(c.key)
                            else next.add(c.key)
                            return next
                          })}
                          style={{
                            height: 34, padding: '0 12px', borderRadius: 17, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                            background: on ? 'var(--accent-soft)' : 'var(--bg-input)',
                            border: 'none', fontSize: 13, fontWeight: 500,
                            color: on ? 'var(--accent-text)' : 'var(--text-3)',
                          }}>
                          {on ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} />}
                          {c.title}
                        </button>
                      )
                    })}
                  </div>
                  <button className="btn btn-primary btn-full" disabled={selectedCands.length === 0} onClick={openCreateSheet}>
                    Create List with {selectedCands.length} {selectedCands.length === 1 ? 'Item' : 'Items'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Suggested for you ── */}
            {(hasTemplateSuggestion || tplCreated) && (
              <div>
                <p style={sectionLabel}>Suggested for You</p>
                <div style={card}>
                  {tplCreated ? (
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', margin: 0 }}>
                      ✓ "Essential Groceries" saved — find it under Templates.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>🛒 Essential Groceries</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '2px 0 0' }}>
                        Based on your frequently purchased items · {tplItems.length} items
                      </p>
                      {tplPreview && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {tplItems.map(t => (
                            <span key={t.key} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--bg-input)', color: 'var(--text-2)' }}>{t.title}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2" style={{ marginTop: 12 }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setTplPreview(v => !v)}>
                          {tplPreview ? 'Hide Preview' : 'Preview'}
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateTemplate}>Create</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Top recommendations ── */}
            {recommendations.length > 0 && (
              <div ref={recsRef}>
                <p style={sectionLabel}>Top Recommendations</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recommendations.map((r, i) => (
                    <div key={r.title} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--accent-soft)', color: 'var(--accent-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                      }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{r.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '1px 0 0' }}>{r.desc}</p>
                      </div>
                      <button onClick={r.action} className="btn btn-sm"
                        style={{ flexShrink: 0, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: 'none', fontWeight: 700 }}>
                        {r.btn}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Member activity (shared only) ── */}
            {memberStats && (
              <div>
                <p style={sectionLabel}>Member Activity</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {memberStats.topAdder && (
                    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: `hsl(${(memberStats.topAdder[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{memberStats.topAdder[0][0]?.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person(memberStats.topAdder[0])}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Added {memberStats.topAdder[1]} item{memberStats.topAdder[1] !== 1 ? 's' : ''}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>Top Adder</span>
                    </div>
                  )}
                  {memberStats.topCompleter && memberStats.topCompleter[0] !== memberStats.topAdder?.[0] && (
                    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: `hsl(${(memberStats.topCompleter[0].charCodeAt(0) * 47) % 360}deg, 55%, 45%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{memberStats.topCompleter[0][0]?.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person(memberStats.topCompleter[0])}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-3)' }}>Checked off {memberStats.topCompleter[1]} item{memberStats.topCompleter[1] !== 1 ? 's' : ''}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Top Completer</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── YFT (benefit-driven) ── */}
            <div style={card}>
              <p style={sectionLabel}>Track Your Shopping Spend</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.55 }}>
                Listo helps you plan what to buy. YFT helps you track how much you spend and manage your monthly budget.
              </p>
              <button
                onClick={() => openYft('/tracker/monthly')}
                className="btn btn-secondary btn-full"
                style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/yft.png" alt="YFT" style={{ width: 22, height: 22, borderRadius: 6 }} />
                  Track Spending in YFT
                </span>
                <ChevronRight size={16} color="var(--text-3)" />
              </button>
            </div>

            {/* ── Export ── */}
            <div style={card}>
              <p style={sectionLabel}>Export Report</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.55 }}>
                Download your shopping summary, items, insights, and recommendations.
              </p>
              <button className="btn btn-primary btn-full" onClick={() => setExportOpen(true)}>
                <FileText size={15} /> Export Report
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Create-list sheet (from prediction) ── */}
      {createOpen && (
        <Sheet open onClose={() => { if (!creating) setCreateOpen(false) }} ariaLabel="Create shopping list" zIndex={210}>
            <div className="sheet-body">
              {createdList ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <Check size={30} color="var(--accent)" strokeWidth={2.5} style={{ margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Shopping list created</p>
                  <p className="text-sm text-muted" style={{ marginTop: 4 }}>"{createdList.name}" with {selectedCands.length} items.</p>
                  <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
                    onClick={() => { const id = createdList.id; setCreateOpen(false); onClose(); navigate(`/list/${id}`) }}>
                    Open List
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>Create Shopping List</p>
                    <button onClick={() => setCreateOpen(false)} aria-label="Close"
                      style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--bg-input)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="predicted-name">List name</label>
                    <input id="predicted-name" className="input" value={createName} onChange={e => setCreateName(e.target.value)} autoFocus />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-3)', margin: 0 }}>
                    {selectedCands.length} suggested {selectedCands.length === 1 ? 'item' : 'items'} selected
                  </p>
                  <button className="btn btn-primary btn-full" disabled={creating || !createName.trim()} onClick={handleCreateList}>
                    {creating ? <><span className="spinner" style={{ marginRight: 8 }} />Creating…</> : 'Create List'}
                  </button>
                </>
              )}
            </div>
        </Sheet>
      )}

      {/* ── Export format sheet ── */}
      {exportOpen && (
        <Sheet open onClose={() => { if (!exporting) setExportOpen(false) }} ariaLabel="Export report" zIndex={210}>
            <div className="sheet-body" style={{ gap: 10 }}>
              <p style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>Export Report</p>
              {([
                { id: 'pdf' as const, title: 'PDF Report', desc: 'Best for sharing and printing' },
                { id: 'csv' as const, title: 'Excel Spreadsheet (CSV)', desc: 'Best for detailed analysis' },
              ]).map(o => (
                <button key={o.id} onClick={() => setExportFormat(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    background: exportFormat === o.id ? 'var(--accent-soft)' : 'var(--bg-input)',
                    border: exportFormat === o.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${exportFormat === o.id ? 'var(--accent)' : 'var(--text-3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {exportFormat === o.id && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{o.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{o.desc}</span>
                  </span>
                </button>
              ))}
              <button className="btn btn-primary btn-full" disabled={exporting} onClick={handleExport}>
                {exporting ? <><span className="spinner" style={{ marginRight: 8 }} />Exporting…</> : 'Export'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => setExportOpen(false)}>Cancel</button>
            </div>
        </Sheet>
      )}
    </div>
  )
}
