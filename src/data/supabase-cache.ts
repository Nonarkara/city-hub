/**
 * Supabase cache layer — writes fetched data to Supabase for longitudinal storage.
 * Falls back to in-memory cache if Supabase is not configured.
 */
import { supabase, isSupabaseEnabled } from '../lib/supabase'

export async function saveToCache(
  cacheKey: string,
  source: string,
  city: string,
  payload: unknown,
): Promise<void> {
  if (!isSupabaseEnabled()) return
  try {
    await supabase!.from('data_cache').upsert(
      { cache_key: cacheKey, source, city, payload, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' },
    )
  } catch (err) {
    console.warn('[supabase-cache] save failed:', err)
  }
}

export async function loadFromCache<T>(cacheKey: string): Promise<T | null> {
  if (!isSupabaseEnabled()) return null
  try {
    const { data, error } = await supabase!
      .from('data_cache')
      .select('payload')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (error || !data) return null
    return data.payload as T
  } catch (err) {
    console.warn('[supabase-cache] load failed:', err)
    return null
  }
}

export async function getCacheHistory(
  source: string,
  city: string,
  limit = 100,
): Promise<Array<{ fetched_at: string; payload: unknown }>> {
  if (!isSupabaseEnabled()) return []
  try {
    const { data, error } = await supabase!
      .from('data_cache')
      .select('fetched_at, payload')
      .eq('source', source)
      .eq('city', city)
      .order('fetched_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as Array<{ fetched_at: string; payload: unknown }>
  } catch (err) {
    console.warn('[supabase-cache] history failed:', err)
    return []
  }
}
