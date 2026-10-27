import type { SupabaseClient } from '@supabase/supabase-js'
import { editions } from '../config/editions'
import { getSupabase } from './supabase'
import type { Database } from '../types/database'
import type { GuestTicket } from '../../supabase/functions/_shared/guest-handler'

export type { GuestTicket }
let claimInFlight: Promise<GuestTicket | null> | null = null

async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  // Prevent two new tabs from creating different anonymous identities together.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('halloween-mazoxi:guest', work) : work()
}

async function callGuestTicket(client: SupabaseClient<Database>, action: 'lookup' | 'claim') {
  return withSessionLock(async () => {
    const { data, error } = await client.auth.getSession()
    if (error) throw new Error('Δεν ήταν δυνατή η επαναφορά της συνεδρίας. Δοκίμασε ξανά.')
    if (!data.session) {
      if (action === 'lookup') return null
      const { error: signInError } = await client.auth.signInAnonymously()
      if (signInError) throw new Error('Η σύνδεση επισκέπτη απέτυχε. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.')
    }
    const invoke = () => client.functions.invoke('guest-ticket', { body: { action }, timeout: 20000 })
    let result = await invoke()
    if (result.error?.context instanceof Response && result.error.context.status === 401) {
      const { error: refreshError } = await client.auth.refreshSession()
      if (refreshError) throw new Error('Η συνεδρία έληξε. Δεν δημιουργήθηκε νέα συνεδρία. Δοκίμασε ξανά.')
      result = await invoke()
    }
    if (result.error) throw new Error('Δεν ήταν δυνατή η φόρτωση του εισιτηρίου. Δοκίμασε ξανά· η ίδια συνεδρία διατηρεί το εισιτήριό σου.')
    return parseGuestTicket(result.data?.ticket)
  })
}

export function parseGuestTicket(value: unknown): GuestTicket | null {
  if (value === null) return null
  const t = value as GuestTicket
  if (!t || typeof t.id !== 'string' || typeof t.ownerId !== 'string' || typeof t.displayNumber !== 'string'
    || !editions.some(e => e.id === t.editionId) || !['issued', 'redeemed'].includes(t.status)
    || typeof t.createdAt !== 'string' || (t.status === 'issued' && !/^hm1_[\w-]{43}$/.test(t.qrCredential || ''))
    || (t.status === 'redeemed' && (t.qrCredential !== null || typeof t.redeemedAt !== 'string'))) {
    throw new Error('Το εισιτήριο δεν ήταν έγκυρο. Δοκίμασε ξανά.')
  }
  return t
}

export async function loadGuestTicket() {
  const supabase = await getSupabase()
  return callGuestTicket(supabase, 'lookup')
}
export function claimGuestTicket() {
  if (claimInFlight) return claimInFlight
  claimInFlight = (async () => {
    const supabase = await getSupabase()
    const ticket = await callGuestTicket(supabase, 'claim')
    if (!ticket) throw new Error('Η έκδοση δεν ολοκληρώθηκε. Δοκίμασε ξανά.')
    return ticket
  })().finally(() => { claimInFlight = null })
  return claimInFlight
}
