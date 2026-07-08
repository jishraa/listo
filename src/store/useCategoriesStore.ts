import { create } from 'zustand'
import * as categoriesApi from '../lib/api/categories'
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
    const stored = await categoriesApi.fetchUserCategories(userId)
    if (stored) {
      // Merge with defaults so newly shipped list types still get categories
      set({ categories: { ...cloneDefaults(), ...stored }, loaded: true })
      return
    }
    set({ categories: cloneDefaults(), loaded: true })
  },

  saveCategory: async (type, cat) => {
    const prev = get().categories
    const list = prev[type]
    const exists = list.some(c => c.id === cat.id)
    const nextList = exists ? list.map(c => c.id === cat.id ? cat : c) : [...list, cat]
    const next = { ...prev, [type]: nextList }
    set({ categories: next })
    const err = await categoriesApi.upsertUserCategories(get().userId, next)
    if (err) set({ lastError: err })
  },

  deleteCategory: async (type, id) => {
    const prev = get().categories
    const next = { ...prev, [type]: prev[type].filter(c => c.id !== id) }
    set({ categories: next })
    const err = await categoriesApi.upsertUserCategories(get().userId, next)
    if (err) set({ lastError: err })
  },
}))
