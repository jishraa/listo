import { supabase } from '../supabase'
import type { MemoryItem } from '../../store/useMemoryStore'

// Repository layer for List Memory (`item_history`, migration v14).

export async function fetchHistory(userId: string): Promise<MemoryItem[] | null> {
  const { data, error } = await supabase
    .from('item_history')
    .select('name_key, display_name, category, last_quantity, count')
    .eq('user_id', userId)
    .order('count', { ascending: false })
    .order('last_used', { ascending: false })
    .limit(200)
  if (error || !data) return null
  return data.map(r => ({
    nameKey: r.name_key as string,
    name: r.display_name as string,
    category: (r.category as string | null) ?? null,
    lastQuantity: (r.last_quantity as string | null) ?? null,
    count: r.count as number,
  }))
}

/** Fire-and-forget usage record — history must never block an add. */
export function recordItemUse(name: string, category: string | null, quantity: string | null): void {
  supabase.rpc('record_item_use', {
    p_name: name, p_category: category ?? '', p_quantity: quantity ?? '',
  }).then(() => {})
}
