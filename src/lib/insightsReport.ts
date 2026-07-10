import type { jsPDF } from 'jspdf'
import type { List } from '../types'
import { deliverFile, slugify } from './report'

// Infographic PDF for the Shopping Insights screen — mirrors what's on screen
// (health score, efficiency, behaviour, categories, trends, prediction,
// recommendations, member activity) using jsPDF drawing primitives, so it
// stays a lazy chunk with no extra dependency. All number-crunching happens in
// the component (analytics.ts); this file only draws.

type RGB = [number, number, number]
const GREEN: RGB = [22, 163, 74]
const DARK: RGB = [17, 24, 39]
const MUTED: RGB = [107, 114, 128]
const AMBER: RGB = [180, 83, 9]
const LIGHT: RGB = [240, 249, 244]
const BORDER: RGB = [226, 232, 240]
const TRACK: RGB = [233, 236, 239]
const WHITE: RGB = [255, 255, 255]

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return Number.isNaN(n) ? [148, 163, 184] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export interface InsightsReportData {
  score: number
  scoreTitle: string
  scoreSub: string
  potential: number
  checklist: { ok: boolean; text: string }[]
  efficiency: { pct: number; done: number; total: number; pending: number; forgotten: number; dupeCount: number }
  behaviour: { day: string | null; avg: number; listCount: number }
  categories: { name: string; color: string; total: number; done: number; share: number }[]
  trends: { name: string; diff: number }[]
  prediction: { confidence: number; items: string[] } | null
  recommendations: { title: string; desc: string }[]
  members: { topAdder?: [string, number]; topCompleter?: [string, number] } | null
  isShopping: boolean
}

export function renderInsightsPdf(doc: jsPDF, list: List, d: InsightsReportData) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 14
  const W = pageW - M * 2
  let y = 0

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const font = (style: 'normal' | 'bold', size: number) => { doc.setFont('helvetica', style); doc.setFontSize(size) }
  const need = (h: number) => { if (y + h > pageH - 16) { doc.addPage(); y = 16 } }
  const section = (t: string) => {
    need(14)
    y += 3
    font('bold', 8.5); ink(MUTED)
    doc.text(t.toUpperCase(), M, y)
    y += 5
  }
  const cardBox = (h: number, bg: RGB = WHITE) => {
    fill(bg); stroke(BORDER); doc.setLineWidth(0.3)
    doc.roundedRect(M, y, W, h, 3, 3, 'FD')
  }

  // ── Header band ──
  fill(GREEN); doc.rect(0, 0, pageW, 34, 'F')
  ink(WHITE)
  font('bold', 10); doc.text('LISTO', M, 12)
  font('bold', 18); doc.text('Shopping Insights', M, 21)
  font('normal', 10.5); doc.text(list.name, M, 29, { maxWidth: W })
  y = 42

  font('normal', 9); ink(MUTED)
  doc.text(
    `Generated ${new Date().toLocaleDateString()}   ·   ${d.efficiency.done}/${d.efficiency.total} completed (${d.efficiency.pct}%)`,
    M, y,
  )
  y += 6

  // ── Shopping Health ──
  section('Shopping Health')
  const chkH = d.checklist.length * 5.4
  const healthH = 12 + Math.max(30, 6 + 6 + 8 + chkH) + (d.potential > 0 ? 9 : 0)
  need(healthH)
  cardBox(healthH)
  const hTop = y
  const bx = M + 22, by = hTop + 22
  fill(LIGHT); doc.circle(bx, by, 15, 'F')
  stroke(GREEN); doc.setLineWidth(1.1); doc.circle(bx, by, 15, 'S')
  ink(GREEN); font('bold', 22); doc.text(String(d.score), bx, by + 1, { align: 'center' })
  ink(MUTED); font('normal', 8); doc.text('/100', bx, by + 7, { align: 'center' })

  const tx = M + 44
  let ty = hTop + 11
  ink(DARK); font('bold', 12); doc.text(d.scoreTitle, tx, ty); ty += 5
  ink(MUTED); font('normal', 9); doc.text(d.scoreSub, tx, ty, { maxWidth: W - 44 - 8 }); ty += 7
  const barW = W - (tx - M) - 8
  fill(TRACK); doc.roundedRect(tx, ty, barW, 3, 1.5, 1.5, 'F')
  fill(GREEN); doc.roundedRect(tx, ty, (barW * d.score) / 100, 3, 1.5, 1.5, 'F'); ty += 8
  font('normal', 9.5)
  d.checklist.forEach(c => {
    fill(c.ok ? GREEN : AMBER); doc.circle(tx + 1.4, ty - 1.4, 1.4, 'F')
    ink(c.ok ? DARK : AMBER); doc.text(c.text, tx + 5, ty)
    ty += 5.4
  })
  if (d.potential > 0) {
    const py = hTop + healthH - 5
    stroke(BORDER); doc.setLineWidth(0.3); doc.line(M + 4, py - 3.5, M + W - 4, py - 3.5)
    ink(MUTED); font('normal', 9); doc.text('Potential improvement', M + 6, py)
    ink(GREEN); font('bold', 9); doc.text(`+${d.potential} points`, M + W - 6, py, { align: 'right' })
  }
  y = hTop + healthH + 7

  // ── Shopping Efficiency ──
  section('Shopping Efficiency')
  const e = d.efficiency
  const tiles = [
    { v: `${e.pct}%`, l: 'Completion', s: `${e.done} of ${e.total} items`, c: GREEN },
    { v: String(e.pending), l: 'Pending', s: e.pending > 0 ? 'Items remaining' : 'Nothing left', c: e.pending > 0 ? AMBER : MUTED },
    { v: String(e.forgotten), l: 'Forgotten', s: e.forgotten > 0 ? 'From past lists' : 'None missed', c: e.forgotten > 0 ? AMBER : MUTED },
    { v: String(e.dupeCount), l: 'Duplicates', s: e.dupeCount > 0 ? 'Review suggested' : 'No duplicates', c: e.dupeCount > 0 ? AMBER : MUTED },
  ]
  const gap = 8, tileW = (W - gap) / 2, tileH = 24
  need(tileH * 2 + gap)
  const eTop = y
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const tX = M + col * (tileW + gap), tY = eTop + row * (tileH + gap)
    fill(WHITE); stroke(BORDER); doc.setLineWidth(0.3); doc.roundedRect(tX, tY, tileW, tileH, 3, 3, 'FD')
    ink(t.c); font('bold', 18); doc.text(t.v, tX + 8, tY + 12)
    ink(DARK); font('bold', 10.5); doc.text(t.l, tX + 8, tY + 18)
    ink(MUTED); font('normal', 8.5); doc.text(t.s, tX + 8, tY + 22.5)
  })
  y = eTop + tileH * 2 + gap + 7

  // ── Shopping Behaviour ──
  if (d.behaviour.listCount >= 2 && d.behaviour.day) {
    section('Shopping Behaviour')
    const bH = 20
    need(bH)
    const bTop = y
    const cells = [
      { l: 'Most Active Day', v: d.behaviour.day },
      { l: 'Avg Items per List', v: String(d.behaviour.avg) },
    ]
    cells.forEach((it, i) => {
      const tX = M + i * (tileW + gap)
      fill(WHITE); stroke(BORDER); doc.setLineWidth(0.3); doc.roundedRect(tX, bTop, tileW, bH, 3, 3, 'FD')
      ink(DARK); font('bold', 13); doc.text(String(it.v), tX + 8, bTop + 11)
      ink(MUTED); font('normal', 8.5); doc.text(it.l, tX + 8, bTop + 16)
    })
    y = bTop + bH + 7
  }

  // ── Category Analysis ──
  if (d.categories.length) {
    section('Category Analysis')
    const cats = d.categories.slice(0, 8)
    const rowH = 13
    const cH = 8 + cats.length * rowH
    need(cH)
    cardBox(cH)
    let cy = y + 8
    cats.forEach(c => {
      const comp = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
      ink(DARK); font('bold', 10); doc.text(c.name, M + 6, cy)
      ink(MUTED); font('bold', 10); doc.text(`${c.share}%`, M + W - 6, cy, { align: 'right' })
      ink(MUTED); font('normal', 8); doc.text(`${c.total} ${c.total === 1 ? 'item' : 'items'}  ·  ${c.done} completed`, M + 6, cy + 4)
      const bw = W - 12
      fill(TRACK); doc.roundedRect(M + 6, cy + 6, bw, 2.6, 1.3, 1.3, 'F')
      fill(hexToRgb(c.color)); doc.roundedRect(M + 6, cy + 6, (bw * comp) / 100, 2.6, 1.3, 1.3, 'F')
      cy += rowH
    })
    y += cH + 7
  }

  // ── Shopping Trends ──
  if (d.trends.length) {
    section('Shopping Trends')
    const rowH = 6.5
    const tH = 12 + d.trends.length * rowH
    need(tH)
    cardBox(tH)
    ink(MUTED); font('normal', 8); doc.text('Compared with your previous lists', M + 6, y + 7)
    let tY = y + 13
    d.trends.forEach(t => {
      ink(DARK); font('normal', 9.5); doc.text(t.name, M + 6, tY)
      const s = t.diff === 0 ? 'no change' : t.diff > 0 ? `+${t.diff}%` : `-${Math.abs(t.diff)}%`
      ink(t.diff === 0 ? MUTED : t.diff > 0 ? GREEN : AMBER); font('bold', 9.5)
      doc.text(s, M + W - 6, tY, { align: 'right' })
      tY += rowH
    })
    y += tH + 7
  }

  // ── Predicted Next List ──
  if (d.prediction) {
    section('Predicted Next List')
    font('normal', 9)
    const lines = doc.splitTextToSize(d.prediction.items.join(',  '), W - 12) as string[]
    const pH = 16 + lines.length * 4.6
    need(pH)
    cardBox(pH)
    ink(GREEN); font('bold', 9.5)
    doc.text(`Smart Prediction  ·  ${d.prediction.confidence}% confidence`, M + 6, y + 8)
    ink(DARK); font('normal', 9); doc.text(lines, M + 6, y + 14)
    y += pH + 7
  }

  // ── Top Recommendations ──
  if (d.recommendations.length) {
    section('Top Recommendations')
    d.recommendations.forEach((r, i) => {
      const rH = 15
      need(rH + 4)
      cardBox(rH)
      fill(LIGHT); doc.circle(M + 9, y + 7.5, 4, 'F')
      ink(GREEN); font('bold', 9); doc.text(String(i + 1), M + 9, y + 8.8, { align: 'center' })
      ink(DARK); font('bold', 10); doc.text(r.title, M + 18, y + 7)
      ink(MUTED); font('normal', 8.5); doc.text(r.desc, M + 18, y + 11.5, { maxWidth: W - 24 })
      y += rH + 4
    })
    y += 3
  }

  // ── Member Activity ──
  if (d.members) {
    section('Member Activity')
    const rows: { name: string; sub: string; tag: string }[] = []
    if (d.members.topAdder) {
      rows.push({ name: d.members.topAdder[0], sub: `Added ${d.members.topAdder[1]} item${d.members.topAdder[1] !== 1 ? 's' : ''}`, tag: 'Top Adder' })
    }
    if (d.members.topCompleter && d.members.topCompleter[0] !== d.members.topAdder?.[0]) {
      rows.push({ name: d.members.topCompleter[0], sub: `Checked off ${d.members.topCompleter[1]} item${d.members.topCompleter[1] !== 1 ? 's' : ''}`, tag: 'Top Completer' })
    }
    rows.forEach(r => {
      const rH = 15
      need(rH + 4)
      cardBox(rH)
      ink(DARK); font('bold', 10); doc.text(r.name, M + 6, y + 7)
      ink(MUTED); font('normal', 8.5); doc.text(r.sub, M + 6, y + 11.5)
      ink(GREEN); font('bold', 8); doc.text(r.tag, M + W - 6, y + 8, { align: 'right' })
      y += rH + 4
    })
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    ink(MUTED); font('normal', 8)
    if (d.isShopping) doc.text('Track your grocery budget in YFT — yft.grk766.workers.dev', M, pageH - 8)
    doc.text(`Listo  ·  Page ${p} of ${pages}`, pageW - M, pageH - 8, { align: 'right' })
  }
}

// Builds and delivers the infographic insights PDF. jspdf is imported lazily so
// it stays out of the initial bundle (see the bundle budget in TESTING.md).
export async function exportInsightsReport(list: List, data: InsightsReportData) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  renderInsightsPdf(doc, list, data)
  const blob = doc.output('blob')
  await deliverFile(blob, `${slugify(list.name)}-insights.pdf`, 'application/pdf', `${list.name} — Listo insights`)
}
