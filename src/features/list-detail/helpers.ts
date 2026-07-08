import type { CSSProperties } from 'react'
import { storageKeys, readJSON } from '../../lib/storage'

// Shared bits of the list-detail feature (extracted from the ListDetail page).

export type SortMode = 'date' | 'alpha' | 'category'

// Category filter pill — 36px, non-truncating; soft green tint when active so
// the strongest Listo green stays reserved for CTAs/progress (spec §1.1–1.2).
export function pillStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 18, cursor: 'pointer',
    whiteSpace: 'nowrap', border: 'none',
    background: active ? 'var(--accent-soft)' : 'var(--bg-input)',
    color: active ? 'var(--accent-text)' : 'var(--text-2)',
    fontSize: 13, fontWeight: active ? 700 : 500,
    transition: 'background 160ms ease, color 160ms ease',
  }
}

export const sectionLabel: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
  color: 'var(--text-3)', textTransform: 'uppercase',
}

// Per-list view preferences (spec §4.2) — persisted under listo-view-<id>
// only while "remember" is on; otherwise they last for the session.
export type ViewPrefs = { categories: boolean; addedBy: boolean; autoExpand: boolean; remember: boolean }
export const DEFAULT_VIEW_PREFS: ViewPrefs = { categories: true, addedBy: true, autoExpand: false, remember: true }
export function readViewPrefs(id: string | undefined): ViewPrefs {
  if (!id) return DEFAULT_VIEW_PREFS
  return { ...DEFAULT_VIEW_PREFS, ...readJSON<Partial<ViewPrefs>>(storageKeys.viewPrefs(id), {}) }
}

export function formatCompletedAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `today at ${time}`
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return `yesterday at ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

// Lists that have already shown the auto "Before you go" nudge this session —
// so completing a list prompts once, never repeatedly.
export const beforeYouGoAutoShown = new Set<string>()

// Duplicate groups the user chose to keep (by normalized name), persisted per
// list so "Keep both" permanently dismisses that warning.
export function readKeptDupes(id: string | undefined): string[] {
  if (!id) return []
  return readJSON<string[]>(storageKeys.keptDupes(id), [])
}
