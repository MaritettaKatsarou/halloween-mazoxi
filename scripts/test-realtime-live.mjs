// Hosted checks use only new, tagged disposable guest tickets. No bearer, QR or
// password is printed. The runner pauses before any admission for rollback QA.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(predicate, label, timeout = 15000) {
  const start = Date.now()
  while (!predicate()) { if (Date.now() - start > timeout) throw Error(label); await pause(75) }
}
export async function runRealtimeLiveTests({ adminEmail, adminPassword }, checkpoint) {
  const env = loadEnv('development', fileURLToPath(new URL('../', import.meta.url)), '')
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url !== 'https://hefzzwfmpdukwceuwgqr.supabase.co' || !key?.startsWith('sb_publishable_')) throw Error('Unverified project')
  const clients = [], checks = [], testRun = randomUUID(), owners = [], tickets = []
  const check = (value, label) => { if (!value) throw Error('Failed: ' + label); checks.push(label) }
  const client = () => { const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(c); return c }
  const admin = client(), guests = [client(), client(), client()]
  const adminCall = async (action, credential) => {
    const r = await admin.functions.invoke('admin-ticket', { body: { action, ...(credential ? { credential } : {}) } })
    if (r.error) throw Error('Admin test request failed')
    return r.data
  }
  const lookup = async guest => {
    const r = await guest.functions.invoke('guest-ticket', { body: { action: 'lookup' } })
    if (r.error) throw Error('Owner lookup failed')
    return r.data.ticket
  }
  const join = async (c, ticketId, onEvent = () => {}, privateMode = true) => {
    const { data } = await c.auth.getSession()
    if (data.session) await c.realtime.setAuth(data.session.access_token)
    const channel = c.channel('ticket-admission:' + ticketId, { config: { private: privateMode, broadcast: { ack: true, self: true } } })
    channel.on('broadcast', { event: 'admitted' }, message => onEvent(message.payload))
    let last = null
    await new Promise(resolve => {
      const timer = setTimeout(() => { last = 'TIMED_OUT'; resolve() }, 15000)
      channel.subscribe(status => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { last = status; clearTimeout(timer); resolve() }
      })
    })
    return { channel, status: last }
  }
  let stage = 'setup'
  try {
    const signed = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    check(!signed.error && signed.data.user?.is_anonymous === false, 'Disposable permanent admin authenticates')
    const adminId = signed.data.user.id
    for (const guest of guests) {
      const auth = await guest.auth.signInAnonymously({ options: { data: { phase4_test_run: testRun } } })
      if (auth.error) throw Error('Anonymous test sign-in failed')
      owners.push(auth.data.user.id)
      const issued = await guest.functions.invoke('guest-ticket', { body: { action: 'claim' } })
      if (issued.error) throw Error('Disposable ticket claim failed')
      tickets.push(issued.data.ticket)
    }
    const eventsA = [], eventsB = [], committedChecks = []
    const ownA = await join(guests[0], tickets[0].id, payload => {
      eventsA.push(payload)
      committedChecks.push(lookup(guests[0]).then(ticket => ticket.id === tickets[0].id && ticket.status === 'redeemed' && ticket.qrCredential === null))
    })
    const ownB = await join(guests[1], tickets[1].id, payload => eventsB.push(payload))
    check(ownA.status === 'SUBSCRIBED' && ownB.status === 'SUBSCRIBED', 'Correct anonymous owners join their private ticket channels')
    const foreign = await join(guests[1], tickets[0].id)
    check(foreign.status === 'CHANNEL_ERROR', 'Another guest is denied the owner’s private channel')
    await guests[1].removeChannel(foreign.channel)
    const malformed = await join(guests[0], randomUUID())
    check(malformed.status === 'CHANNEL_ERROR', 'Unknown ticket topic is denied')
    await guests[0].removeChannel(malformed.channel)
    const outsider = client(), unauth = await join(outsider, tickets[0].id)
    check(unauth.status === 'CHANNEL_ERROR', 'Unauthenticated private subscription is denied')
    await outsider.removeChannel(unauth.channel)
    const publicClient = client(), publicJoin = await join(publicClient, tickets[0].id, () => {}, false)
    check(publicJoin.status === 'CHANNEL_ERROR', 'Project setting rejects public channel subscriptions')
    await publicClient.removeChannel(publicJoin.channel)
    const sent = await ownA.channel.send({ type: 'broadcast', event: 'admitted', payload: { ticketId: tickets[0].id } }, { timeout: 3000 })
    check(sent !== 'ok', 'Owner is denied authoritative WebSocket publishing')
    const sessionA = (await guests[0].auth.getSession()).data.session
    await fetch(url + '/realtime/v1/api/broadcast', { method: 'POST', headers: {
      apikey: key, Authorization: 'Bearer ' + sessionA.access_token, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ messages: [{ topic: 'ticket-admission:' + tickets[0].id, event: 'admitted', payload: { ticketId: tickets[0].id }, private: true }] }) })
    // The legacy batch endpoint acknowledges the batch even when individual
    // messages fail authorization. Assert delivery, not its batch HTTP status.
    await pause(800)
    check(eventsA.length === 0, 'Legacy REST batch cannot publish an owner admission event')
    let httpDenied = false
    try { await ownA.channel.httpSend('admitted', { ticketId: tickets[0].id }) } catch { httpDenied = true }
    check(httpDenied, 'Owner is denied authoritative REST httpSend publishing')
    const denied = await guests[0].functions.invoke('admin-ticket', { body: { action: 'admit', credential: tickets[0].qrCredential } })
    check(denied.error?.context?.status === 403, 'Guest redemption remains forbidden')
    check((await adminCall('validate', 'hm1_' + 'Z'.repeat(43))).result === 'INVALID', 'Invalid credential remains invalid')
    stage = 'rollback'
    await checkpoint({ event: 'ready-for-rollback', testRun, testOwnerIds: owners, testTicketIds: tickets.map(t => t.id), adminId })
    await pause(800)
    check(eventsA.length === 0 && eventsB.length === 0, 'Rollback, invalid redemption and denied publications emit no admission event')
    check((await lookup(guests[0])).status === 'issued', 'Rolled-back admission remains issued')
    stage = 'committed-admission'
    check((await adminCall('admit', tickets[0].qrCredential)).result === 'ADMITTED', 'First disposable ticket is genuinely admitted')
    await until(() => eventsA.length > 0 && committedChecks.length > 0, 'Owner did not receive the committed admission')
    check((await Promise.all(committedChecks)).every(Boolean), 'Every received event corresponds to an authoritative committed redeemed row')
    check(eventsA.every(payload => payload.ticketId === tickets[0].id && Object.keys(payload).every(key => ['ticketId', 'id'].includes(key))), 'Broadcast payload contains only the ticket ID and transport event ID')
    check(eventsB.length === 0, 'Unrelated guest receives no admission information')
    await adminCall('admit', tickets[0].qrCredential)
    await pause(600)
    check(eventsA.length === 1, 'Repeated redemption produces no second Broadcast')
    await guests[1].removeChannel(ownB.channel)
    await adminCall('admit', tickets[1].qrCredential)
    const recovered = await join(guests[1], tickets[1].id)
    check(recovered.status === 'SUBSCRIBED' && (await lookup(guests[1])).status === 'redeemed', 'Reconnect after a missed event recovers committed redemption')
    await adminCall('admit', tickets[2].qrCredential)
    const late = await join(guests[2], tickets[2].id)
    check(late.status === 'SUBSCRIBED' && (await lookup(guests[2])).status === 'redeemed', 'Redemption before subscription is recovered by the post-join fetch')
    const restored = client(), saved = (await guests[0].auth.getSession()).data.session
    await restored.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token })
    const final = await lookup(restored)
    check(final.status === 'redeemed' && final.qrCredential === null, 'Restored session returns permanent redeemed status without an active QR')
    check((await adminCall('validate', tickets[0].qrCredential)).result === 'ALREADY_USED', 'Previously copied QR remains permanently unusable')
    return { event: 'completed', checks, testRun, testOwnerIds: owners, testTicketIds: tickets.map(t => t.id), adminId }
  } catch {
    throw Error(JSON.stringify({ event: 'failed', stage, checks, testRun, testOwnerIds: owners, testTicketIds: tickets.map(t => t.id) }))
  } finally {
    for (const c of clients) { await c.removeAllChannels(); c.realtime.disconnect(); try { await c.auth.signOut({ scope: 'local' }) } catch { /* No credentials logged. */ } }
  }
}
