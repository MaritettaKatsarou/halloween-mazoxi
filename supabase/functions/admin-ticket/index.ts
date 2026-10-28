import { createClient } from '@supabase/supabase-js'
import { AdminDenied, createAdminHandler } from '../_shared/admin-handler.ts'

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const url = Deno.env.get('SUPABASE_URL')!
const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options)
const backend = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options)
Deno.serve(createAdminHandler({
  async authenticate(token) {
    const { data, error } = await auth.auth.getUser(token)
    return !error && data.user ? { id: data.user.id,
      permanent: data.user.is_anonymous === false && !!data.user.email && !!data.user.email_confirmed_at } : null
  },
  async execute(adminId, action, credential, options) {
    const { data, error } = action === 'reset-count'
      ? await backend.rpc('reset_admission_count', { p_admin: adminId, p_request_id: options!.requestId })
      : action === 'periods'
      ? await backend.rpc('admin_counting_history', { p_admin: adminId, p_before_id: options?.beforeId ?? null })
      : action === 'history'
      ? await backend.rpc('admin_admission_history', { p_admin: adminId,
        p_before: options?.cursor?.redeemedAt ?? null, p_before_id: options?.cursor?.id ?? null })
      : await backend.rpc('admin_ticket_action', { p_admin: adminId, p_action: action, p_credential: credential ?? null })
    if (error?.code === '42501') throw new AdminDenied()
    if (error) throw Error('Admin operation failed')
    return data
  },
}))
