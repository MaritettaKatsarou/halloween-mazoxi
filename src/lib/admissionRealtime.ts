import { getSupabase } from './supabase'
import type { GuestTicket } from './guestTickets'

export const admissionTopic = (ticketId: string) => `ticket-admission:${ticketId}`

export async function subscribeToAdmission(ticket: GuestTicket, notify: () => void) {
  const client = await getSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (!data.session || data.session.user.id !== ticket.ownerId) return () => {}
  await client.realtime.setAuth(data.session.access_token)
  const channel = client.channel(admissionTopic(ticket.id), { config: { private: true } })
    .on('broadcast', { event: 'admitted' }, message => {
      // Even a matching notification is only a hint; the controller re-fetches.
      if (message.payload?.ticketId === ticket.id) notify()
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') notify() // Initial join AND every rejoin close the loading race.
    })
  return () => { void client.removeChannel(channel) }
}

export async function observeGuestSession(changed: (ownerId: string | null) => void) {
  const client = await getSupabase()
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    // Do not await Auth methods from inside its locked callback.
    queueMicrotask(() => changed(session?.user.id ?? null))
  })
  return () => data.subscription.unsubscribe()
}
