import type { List, ListItem, ListMember } from '../types'
import { useCategoriesStore } from '../store/useCategoriesStore'
import { LIST_TYPE_LABELS } from './utils'

const GREEN: [number, number, number] = [22, 163, 74]

export function slugify(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'list'
}

export async function deliverFile(blob: Blob, filename: string, mime: string, title: string) {
  const file = new File([blob], filename, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => {})
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

// CSV export — the "Excel" option. Same columns as the PDF table; opens
// directly in Excel / Sheets for detailed analysis.
export async function exportListCsv(list: List, items: ListItem[], members: ListMember[]) {
  const categoryNames = new Map(
    Object.values(useCategoriesStore.getState().categories).flat().map(c => [c.id, c.name])
  )
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows: string[] = [
    ['#', 'Item', 'Qty', 'Category', 'Status', 'Added by', 'Completed by'].join(','),
    ...items.map((i, idx) => [
      String(idx + 1),
      esc(i.title),
      esc(i.quantity ?? ''),
      esc(i.category ? (categoryNames.get(i.category) ?? '') : ''),
      i.completed ? 'Done' : 'Pending',
      esc(i.added_by_name ?? ''),
      esc(i.completed_by_name ?? ''),
    ].join(',')),
  ]
  const done = items.filter(i => i.completed).length
  rows.push('')
  rows.push(['', esc(`${list.name} — ${done} of ${items.length} completed`), '', '', '', '', ''].join(','))
  if (members.length > 1) {
    rows.push(['', esc(`Members: ${members.map(m => m.display_name).join(', ')}`), '', '', '', '', ''].join(','))
  }
  // BOM so Excel detects UTF-8 (quantities use ×)
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  await deliverFile(blob, `${slugify(list.name)}-report.csv`, 'text/csv', `${list.name} — Listo report`)
}

// Generates a PDF report for one list and hands it to the share sheet
// (falls back to a download where Web Share can't send files).
// jspdf is dynamically imported so it stays out of the main bundle.
export async function exportListReport(list: List, items: ListItem[], members: ListMember[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const categoryNames = new Map(
    Object.values(useCategoriesStore.getState().categories).flat().map(c => [c.id, c.name])
  )

  // Brand header band
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('LISTO', 14, 11)
  doc.setFontSize(17)
  doc.text(list.name, 14, 22, { maxWidth: pageW - 28 })

  // Meta block
  const done = items.filter(i => i.completed).length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
  const meta = [
    `Type: ${LIST_TYPE_LABELS[list.type] ?? list.type}`,
    `Progress: ${done} of ${items.length} completed (${pct}%)`,
    ...(members.length > 1 ? [`Members: ${members.map(m => m.display_name).join(', ')}`] : []),
    `Generated: ${new Date().toLocaleString()}`,
  ]
  doc.setTextColor(80, 80, 80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(meta, 14, 39)

  autoTable(doc, {
    startY: 39 + meta.length * 5 + 3,
    head: [['#', 'Item', 'Qty', 'Category', 'Status', 'Added by']],
    body: items.map((i, idx) => [
      String(idx + 1),
      i.title,
      i.quantity ?? '',
      i.category ? (categoryNames.get(i.category) ?? '') : '',
      i.completed ? 'Done' : 'Pending',
      i.added_by_name,
    ]),
    headStyles: { fillColor: GREEN, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [243, 250, 245] },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 18 }, 4: { cellWidth: 20 } },
    margin: { left: 14, right: 14 },
  })

  // Companion footer (YFT integration spec §4) — shopping lists only
  if (list.type === 'shopping') {
    const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 260
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text('Next step: track this month\'s grocery budget in YFT — yft.grk766.workers.dev', 14, Math.min(y + 12, 285))
  }

  const blob = doc.output('blob')
  await deliverFile(blob, `${slugify(list.name)}-report.pdf`, 'application/pdf', `${list.name} — Listo report`)
}
