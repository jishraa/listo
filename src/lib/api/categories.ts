import { supabase } from '../supabase'
import type { CategoryMap } from '../../store/useCategoriesStore'

// Repository layer for per-user category customization (`user_categories`, v6).

export async function fetchUserCategories(userId: string): Promise<Partial<CategoryMap> | null> {
  try {
    const { data, error } = await supabase
      .from('user_categories').select('categories').eq('user_id', userId).maybeSingle()
    if (!error && data?.categories) return data.categories as Partial<CategoryMap>
  } catch { /* fall through */ }
  return null
}

/** Persist the whole map. Returns a user-facing error message, or null. */
export async function upsertUserCategories(userId: string, categories: CategoryMap): Promise<string | null> {
  const { error } = await supabase
    .from('user_categories')
    .upsert({ user_id: userId, categories, updated_at: new Date().toISOString() })
  if (!error) return null
  // Table missing (migration v6 not applied) — keep working locally
  if (error.code === '42P01') return "Changes saved for this session only — category sync isn't set up yet."
  return "Couldn't save categories — try again."
}
