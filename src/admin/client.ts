import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { AdminAction, AdminOperationOptions } from '../../supabase/functions/_shared/admin-handler'
export type { AdminDashboard, AdmissionResult, AdminHistory, ResetCountResult, CountingHistory, ClosedPeriod, PeriodSnapshot } from '../../supabase/functions/_shared/admin-handler'
export const ADMIN_STORAGE_KEY = 'halloween-mazoxi:admin:v1'
let client: Promise<SupabaseClient<Database>> | undefined
export function getAdminClient() {
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return Promise.reject(Error('Admin service is not configured.'))
  return client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient<Database>(url, key, {
    auth: { storageKey: ADMIN_STORAGE_KEY, storage: window.sessionStorage,
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }))
}
export class AdminAccessError extends Error {}
export async function adminRequest<T>(action: AdminAction, credential?: string, options?: AdminOperationOptions): Promise<T> {
  const client = await getAdminClient()
  const { data: auth, error } = await client.auth.getSession()
  if (error || !auth.session || auth.session.user.is_anonymous) throw new AdminAccessError('Sign in with your administrator account.')
  const invoke = () => client.functions.invoke('admin-ticket', {
    body: { action, ...(credential !== undefined ? { credential } : {}), ...options }, timeout: 20000,
  })
  let result = await invoke()
  if (result.error?.context instanceof Response && result.error.context.status === 401) {
    const { error } = await client.auth.refreshSession()
    if (error) throw new AdminAccessError('Your session expired. Sign in again.')
    result = await invoke()
  }
  if (result.error) {
    const status = result.error.context instanceof Response ? result.error.context.status : 0
    if (status === 401 || status === 403) throw new AdminAccessError('Administrator access was denied. Sign in again.')
    throw Error(action === 'reset-count'
      ? 'Reset could not be confirmed. Retry this confirmation with the same request, or cancel and refresh counts to check the saved baseline. Tickets remain unchanged.'
      : action === 'dashboard' || action === 'history' || action === 'periods' ? 'Counts could not be loaded. Please retry.'
      : 'Connection interrupted. Validate the code again to check its current status.')
  }
  return result.data as T
}
export async function signInAdmin(email: string, password: string) {
  const client = await getAdminClient()
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user || data.user.is_anonymous) throw new AdminAccessError('Email or password was not accepted.')
  try { await adminRequest('session') }
  catch (error) { await client.auth.signOut({ scope: 'local' }); throw error }
}
export async function signOutAdmin() {
  const client = await getAdminClient()
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw Error('Sign out failed. Please retry.')
}
