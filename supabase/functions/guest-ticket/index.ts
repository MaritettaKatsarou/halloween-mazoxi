import { createClient } from '@supabase/supabase-js'
import { createGuestHandler } from '../_shared/guest-handler.ts'
import type { GuestTicket } from '../_shared/guest-handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const backend = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(createGuestHandler({
  async authenticate(token) {
    const { data, error } = await authClient.auth.getUser(token)
    return !error && data.user ? { id: data.user.id, isAnonymous: data.user.is_anonymous === true } : null
  },
  async issue(ownerId, create) {
    const { data, error } = await backend.rpc('issue_guest_ticket', { p_owner: ownerId, p_create: create })
    if (error) throw new Error('Issuance unavailable')
    return data as GuestTicket | null
  },
}))
