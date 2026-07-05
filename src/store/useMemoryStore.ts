import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// List Memory: a per-user record of what they add, so lists get faster to
// build. Populated by store.addItem (fire-and-forget) and read back for
// "your regulars" chips and type-ahead that knows the usual quantity.

export interface MemoryItem {
  nameKey: string
  name: string
  category: string | null
  lastQuantity: string | null
  count: number
}

export const memoryKey = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

// Pure selectors over a history list — shared by the store methods and by
// components (which pass the reactive `history` slice directly, so React
// re-derives when it changes).
export const regularsOf = (history: MemoryItem[], exclude: Set<string>, n = 8) =>
  history.filter(h => !exclude.has(h.nameKey)).slice(0, n)

export const suggestOf = (history: MemoryItem[], prefix: string, exclude: Set<string>, n = 5) => {
  const p = memoryKey(prefix)
  if (!p) return []
  return history
    .filter(h => h.nameKey.startsWith(p) && h.nameKey !== p && !exclude.has(h.nameKey))
    .slice(0, n)
}

// "Before you go": regulars (bought 2+ times) that aren't on this list yet —
// the things you usually buy but probably forgot. `presentKeys` are the
// memoryKeys of every item already on the list (pending or completed).
export const forgottenRegulars = (history: MemoryItem[], presentKeys: Set<string>, n = 6) =>
  history.filter(h => h.count >= 2 && !presentKeys.has(h.nameKey)).slice(0, n)

interface MemoryState {
  history: MemoryItem[]
  loaded: boolean
  userId: string
  load: (userId: string) => Promise<void>
  record: (name: string, category: string | null, quantity: string | null) => void
  reset: () => void
  /** Top items by frequency, excluding names already present. */
  regulars: (exclude: Set<string>, n?: number) => MemoryItem[]
  /** History items whose name starts with the prefix, excluding present names. */
  suggest: (prefix: string, exclude: Set<string>, n?: number) => MemoryItem[]
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  history: [],
  loaded: false,
  userId: '',

  load: async (userId) => {
    if (get().userId === userId && get().loaded) return
    set({ userId })
    const { data, error } = await supabase
      .from('item_history')
      .select('name_key, display_name, category, last_quantity, count')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .order('last_used', { ascending: false })
      .limit(200)
    if (error || !data) { set({ loaded: true }); return }
    set({
      loaded: true,
      history: data.map(r => ({
        nameKey: r.name_key as string,
        name: r.display_name as string,
        category: (r.category as string | null) ?? null,
        lastQuantity: (r.last_quantity as string | null) ?? null,
        count: r.count as number,
      })),
    })
  },

  record: (name, category, quantity) => {
    const key = memoryKey(name)
    if (!key) return
    // Optimistic local bump so suggestions reflect the add immediately; the
    // server upsert reconciles on next load.
    const prev = get().history
    const existing = prev.find(h => h.nameKey === key)
    const updated: MemoryItem = existing
      ? { ...existing, name: name.trim(), count: existing.count + 1,
          category: category || existing.category, lastQuantity: quantity || existing.lastQuantity }
      : { nameKey: key, name: name.trim(), category: category || null, lastQuantity: quantity || null, count: 1 }
    set({ history: [updated, ...prev.filter(h => h.nameKey !== key)].sort((a, b) => b.count - a.count) })
    // Fire-and-forget — history is best-effort and must never block an add.
    supabase.rpc('record_item_use', {
      p_name: name.trim(), p_category: category ?? '', p_quantity: quantity ?? '',
    }).then(() => {})
  },

  reset: () => set({ history: [], loaded: false, userId: '' }),

  regulars: (exclude, n = 8) => regularsOf(get().history, exclude, n),
  suggest: (prefix, exclude, n = 5) => suggestOf(get().history, prefix, exclude, n),
}))
