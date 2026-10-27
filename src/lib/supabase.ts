import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
let client: Promise<SupabaseClient<Database>> | undefined
export function getSupabase() {
  if (!url || !key) return Promise.reject(new Error('Η υπηρεσία εισιτηρίων δεν έχει ρυθμιστεί ακόμη.'))
  // Keep the auth/database SDK out of the first visual render's JavaScript chunk.
  return client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      storageKey: 'halloween-mazoxi:auth:v1' },
  }))
}
