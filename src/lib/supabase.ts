/**
 * Supabase client — optional backend for longitudinal data caching.
 *
 * To enable:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Run the SQL in `supabase/schema.sql`
 *   3. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null

export function isSupabaseEnabled(): boolean {
  return !!supabase
}
