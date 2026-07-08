import type { ListType } from '../types'

// Central registry of every localStorage key Listo writes, plus safe JSON
// helpers. New persistence goes through here — never inline `listo-*` string
// literals at call sites (they drift and collide).
//
// NOTE: `listo-theme` is also read by the inline first-paint script in
// index.html; keep the two in sync if it ever changes.

export const storageKeys = {
  // Global
  displayName: 'listo-display-name',
  theme: 'listo-theme',
  listsSort: 'listo-lists-sort',
  defaultListType: 'listo-default-list-type',
  installDismissed: 'listo-install-dismissed',
  // zustand persist stores
  listsCache: 'listo-lists-cache',
  syncQueue: 'listo-sync-queue',
  // Per-user
  pins: (userId: string) => `listo-pins-${userId}`,
  // Per-list
  viewPrefs: (listId: string) => `listo-view-${listId}`,
  listSort: (listId: string) => `listo-sort-${listId}`,
  completedAt: (listId: string) => `listo-completed-${listId}`,
  keptDupes: (listId: string) => `listo-kept-dupes-${listId}`,
} as const

/** Parse a JSON value, falling back on missing keys or corrupt data. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

// User preference set in Profile → Preferences → Default List Type.
// (Lived in CreateListSheet before; moved here so a component file doesn't
// export non-component helpers.)
export function getDefaultListType(): ListType {
  const t = localStorage.getItem(storageKeys.defaultListType)
  return t === 'tasks' || t === 'shopping' ? t : 'personal'
}
