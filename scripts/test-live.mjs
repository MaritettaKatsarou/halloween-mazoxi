// Explicit opt-in hosted integration check. Never prints tokens or credentials.
// Creates two tagged disposable anonymous users; output lists IDs for trusted cleanup.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { randomUUID } from 'node:crypto'

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (url !== 'https://hefzzwfmpdukwceuwgqr.supabase.co' || !key?.startsWith('sb_publishable_')) {
  throw Error('Live tests require the verified halloween-mazoxi project and its publishable key.')
}
const run = randomUUID()
const clients = [], owners = [], passed = []
const check = (condition, label) => { if (!condition) throw Error(`Check failed: ${label}`); passed.push(label) }
const create = () => {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  clients.push(client)
  return client
}
async function call(client, action) {
  const { data, error } = await client.functions.invoke('guest-ticket', { body: { action } })
  if (error) throw Error('Guest Edge Function request failed (no response credentials logged).')
  return data.ticket
}
try {
  const a = create(), b = create()
  for (const client of [a, b]) {
    const { data, error } = await client.auth.signInAnonymously({ options: { data: { phase2_test_run: run } } })
    if (error || !data.user || !data.session) throw Error('Anonymous sign-in failed; check Dashboard settings/rate limits.')
    owners.push(data.user.id)
  }
  check((await call(a, 'lookup')) === null, 'Unclaimed lookup creates no ticket')
  const tickets = await Promise.all(Array.from({ length: 6 }, () => call(a, 'claim')))
  check(tickets.every(t => t.id === tickets[0].id && t.editionId === tickets[0].editionId && t.qrCredential === tickets[0].qrCredential), 'Six simultaneous claims return one ticket, edition and QR')
  const second = await call(b, 'claim')
  check(second.id !== tickets[0].id && second.qrCredential !== tickets[0].qrCredential, 'Two anonymous accounts receive separate tickets and unique QR credentials')
  check(/^hm1_[\w-]{43}$/.test(second.qrCredential), 'Credential encodes 256 random bits')
  const { data: session } = await a.auth.getSession()
  const restored = create()
  const { error: restoreError } = await restored.auth.setSession({ access_token: session.session.access_token, refresh_token: session.session.refresh_token })
  check(!restoreError, 'Existing session can be restored')
  const recovered = await call(restored, 'lookup')
  check(recovered.id === tickets[0].id && recovered.editionId === tickets[0].editionId && recovered.qrCredential === tickets[0].qrCredential, 'Session restoration preserves ticket, artwork and credential')
  const own = await a.from('tickets').select('*')
  check(!own.error && own.data.length === 1 && own.data[0].owner_id === owners[0], 'Owner can read exactly their own ticket')
  check(!Object.keys(own.data[0]).some(k => /credential|secret|hash/.test(k)), 'Guest-readable rows contain no bearer or verification secrets')
  const foreign = await a.from('tickets').select('*').eq('id', second.id)
  check(!foreign.error && foreign.data.length === 0, 'RLS hides another account’s ticket')
  const writes = [
    a.from('tickets').insert({ owner_id: owners[0], edition_id: 'cauldron' }),
    a.from('tickets').update({ edition_id: 'cauldron' }).eq('id', tickets[0].id),
    a.from('tickets').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', tickets[0].id),
    a.from('tickets').update({ owner_id: owners[1] }).eq('id', tickets[0].id),
    a.from('tickets').delete().eq('id', tickets[0].id),
    a.rpc('issue_guest_ticket', { p_owner: owners[1], p_create: true }),
  ]
  const denied = await Promise.all(writes)
  check(denied.every(result => result.error), 'Guest insert, edition change, redemption, reassignment, deletion and privileged RPC are denied')
  const spoof = await a.functions.invoke('guest-ticket', { body: { action: 'claim', ownerId: owners[1] } })
  check(spoof.error?.context?.status === 400, 'Function rejects caller-supplied ownership')
  const unauthorized = await fetch(`${url}/functions/v1/guest-ticket`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', Authorization: 'Bearer invalid-token' }, body: '{"action":"claim"}' })
  check(unauthorized.status === 401, 'Invalid bearer token is rejected')
  const outsider = create()
  const noAuth = await outsider.from('tickets').select('*')
  check(!!noAuth.error, 'Unauthenticated table access is denied')
  console.log(JSON.stringify({ passed, testRun: run, cleanupOwnerIds: owners }))
} catch {
  console.error(JSON.stringify({ failed: 'Hosted integration test failed; no credential values logged.', testRun: run, cleanupOwnerIds: owners, completed: passed }))
  process.exitCode = 1
} finally {
  for (const client of clients) { try { await client.auth.signOut() } catch { /* Cleanup is repeated by trusted SQL for tagged users. */ } }
}
