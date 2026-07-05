import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { LIST_CATEGORIES } from '../lib/constants'
import type { ListCategory } from '../lib/constants'
import type { ListType } from '../types'

export type CategoryMap = Record<ListType, ListCategory[]>

interface CategoriesState {
  categories: CategoryMap
  userId: string
  loaded: boolean
  lastError: string | null
  clearError: () => void
  init: (userId: string) => Promise<void>
  // Reset to shipped defaults — called on sign-out so the next account never
  // sees the previous user's custom categories.
  reset: () => void
  // Adds (new id) or updates (existing id) a category
  saveCategory: (type: ListType, cat: ListCategory) => Promise<void>
  deleteCategory: (type: ListType, id: string) => Promise<void>
}

const cloneDefaults = (): CategoryMap => JSON.parse(JSON.stringify(LIST_CATEGORIES))

export function makeCategoryId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  return `${slug || 'cat'}-${Math.random().toString(36).slice(2, 6)}`
}

async function persist(userId: string, categories: CategoryMap): Promise<string | null> {
  const { error } = await supabase
    .from('user_categories')
    .upsert({ user_id: userId, categories, updated_at: new Date().toISOString() })
  if (!error) return null
  // Table missing (migration v6 not applied) — keep working locally
  if (error.code === '42P01') return "Changes saved for this session only — category sync isn't set up yet."
  return "Couldn't save categories — try again."
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: cloneDefaults(),
  userId: '',
  loaded: false,
  lastError: null,
  clearError: () => set({ lastError: null }),
  reset: () => set({ categories: cloneDefaults(), userId: '', loaded: false, lastError: null }),

  init: async (userId) => {
    if (get().userId === userId && get().loaded) return
    set({ userId })
    try {
      const { data, error } = await supabase
        .from('user_categories')
        .select('categories')
        .eq('user_id', userId)
        .maybeSingle()
      if (!error && data?.categories) {
        // Merge with defaults so newly shipped list types still get categories
        const stored = data.categories as Partial<CategoryMap>
        set({ categories: { ...cloneDefaults(), ...stored }, loaded: true })
        return
      }
    } catch { /* fall through to defaults */ }
    set({ categories: cloneDefaults(), loaded: true })
  },

  saveCategory: async (type, cat) => {
    const prev = get().categories
    const list = prev[type]
    const exists = list.some(c => c.id === cat.id)
    const nextList = exists ? list.map(c => c.id === cat.id ? cat : c) : [...list, cat]
    const next = { ...prev, [type]: nextList }
    set({ categories: next })
    const err = await persist(get().userId, next)
    if (err) set({ lastError: err })
  },

  deleteCategory: async (type, id) => {
    const prev = get().categories
    const next = { ...prev, [type]: prev[type].filter(c => c.id !== id) }
    set({ categories: next })
    const err = await persist(get().userId, next)
    if (err) set({ lastError: err })
  },
}))
