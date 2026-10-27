// Opt-in integration harness. Receives disposable test account passwords only in
// memory; never logs secrets, tokens, or QR credentials. Keeps test tickets/audit.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export async function prepareAdminRevocationCheck({ adminEmail, adminPassword }) {
  const env = loadEnv('development', fileURLToPath(new URL('../', import.meta.url)), '')
  if (env.VITE_SUPABASE_URL !== 'https://hefzzwfmpdukwceuwgqr.supabase.co') throw Error('Unverified project')
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const login = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (login.error) throw Error('Revocation fixture login failed')
  const access = await client.functions.invoke('admin-ticket', { body: { action: 'session' } })
  if (access.error || access.data?.authorized !== true) throw Error('Test admin must be authorized before revocation')
  return { async verifyRevoked() {
    const result = await client.functions.invoke('admin-ticket', { body: { action: 'dashboard' } })
    const passed = result.error?.context?.status === 403
    await client.auth.signOut({ scope: 'local' })
    if (!passed) throw Error('Revocation did not deny the existing admin session')
    return { passed: true, check: 'Already-authenticated admin loses access immediately after allowlist revocation' }
  } }
}

export async function runAdminLiveTests({ adminEmail, adminPassword, unlistedEmail, unlistedPassword }) {
  const env = loadEnv('development', fileURLToPath(new URL('../', import.meta.url)), '')
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url !== 'https://hefzzwfmpdukwceuwgqr.supabase.co' || !key?.startsWith('sb_publishable_')) throw Error('Unverified test project')
  const checks = [], run = randomUUID(), storage = new Map(), clients = []
  const check = (value, label) => { if (!value) throw Error('Live check failed: ' + label); checks.push(label) }
  const create = storageKey => {
    const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: false, storageKey,
      storage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } } })
    clients.push(client); return client
  }
  const admin = create('halloween-mazoxi:admin:v1'), guest = create('halloween-mazoxi:auth:v1')
  const guest2 = create('phase3-guest-2'), unlisted = create('phase3-unlisted')
  const invoke = async (client, action, credential) => {
    const result = await client.functions.invoke('admin-ticket', { body: { action, ...(credential !== undefined ? { credential } : {}) }, timeout: 20000 })
    if (result.error) throw Error('Admin request failed (details suppressed)')
    return result.data
  }
  const deny = async (client, action, credential, status = 403) => {
    const result = await client.functions.invoke('admin-ticket', { body: { action, credential }, timeout: 20000 })
    return result.error?.context?.status === status
  }
  const guestOwners = []
  try {
    for (const client of [guest, guest2]) {
      const { data, error } = await client.auth.signInAnonymously({ options: { data: { phase3_test_run: run } } })
      check(!error && !!data.user, 'Create tagged anonymous test account')
      guestOwners.push(data.user.id)
    }
    const guestSessionBefore = storage.get('halloween-mazoxi:auth:v1')
    const bad = await admin.auth.signInWithPassword({ email: adminEmail, password: randomUUID() })
    check(!!bad.error, 'Incorrect admin password is rejected')
    const login = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    check(!login.error && login.data.user?.is_anonymous === false, 'Permanent admin email/password login succeeds')
    const adminId = login.data.user.id
    check(storage.get('halloween-mazoxi:auth:v1') === guestSessionBefore, 'Admin login preserves the guest session in shared browser storage')
    check((await invoke(admin, 'session')).authorized === true, 'Allowlisted permanent user is authorized')
    const otherLogin = await unlisted.auth.signInWithPassword({ email: unlistedEmail, password: unlistedPassword })
    check(!otherLogin.error, 'Unlisted permanent account can authenticate without admin privilege')
    const claim = async client => {
      const result = await client.functions.invoke('guest-ticket', { body: { action: 'claim' } })
      if (result.error || !result.data?.ticket) throw Error('Test ticket issuance failed')
      return result.data.ticket
    }
    const first = await claim(guest), second = await claim(guest2)
    check(first.id !== second.id, 'Two new test tickets are distinct')
    const before = await invoke(admin, 'dashboard')
    check(before.distribution.length === 12, 'Dashboard includes all 12 real editions')
    check(await deny(guest, 'admit', first.qrCredential), 'Anonymous guest redemption is denied')
    await guest.auth.updateUser({ data: { role: 'admin', is_admin: true } })
    check(await deny(guest, 'dashboard'), 'User-editable admin metadata cannot grant access')
    check(await deny(unlisted, 'admit', first.qrCredential), 'Unlisted permanent account redemption is denied')
    const direct = await guest.rpc('admin_ticket_action', { p_admin: adminId, p_action: 'admit', p_credential: first.qrCredential })
    check(!!direct.error, 'Direct privileged RPC by a guest is denied')
    const write = await guest.from('tickets').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', first.id)
    check(!!write.error, 'Direct guest status update is denied')
    const outsider = create('phase3-outsider')
    check(await deny(outsider, 'admit', first.qrCredential, 401), 'Unauthenticated redemption is denied')
    check((await invoke(admin, 'validate', 'HM-1')).result === 'INVALID', 'Display number is not a credential')
    check((await invoke(admin, 'validate', 'hm1_' + 'Z'.repeat(43))).result === 'INVALID', 'Unknown opaque credential is rejected')
    const valid = await invoke(admin, 'validate', first.qrCredential)
    check(valid.result === 'VALID' && valid.ticket.editionId === first.editionId && valid.ticket.redeemedAt === null, 'Validation returns the correct edition without redemption')
    const afterValidation = await invoke(admin, 'dashboard')
    check(afterValidation.admitted === before.admitted && afterValidation.remaining === before.remaining, 'Validation and unauthorized attempts leave counts unchanged')
    const admitted = await invoke(admin, 'admit', first.qrCredential)
    check(admitted.result === 'ADMITTED' && admitted.ticket.redeemedBy === adminId && !!admitted.ticket.redeemedAt, 'First admission records permanent admin and timestamp')
    for (const action of ['validate', 'admit']) {
      const repeated = await invoke(admin, action, first.qrCredential)
      check(repeated.result === 'ALREADY_USED' && repeated.ticket.redeemedAt === admitted.ticket.redeemedAt, 'Repeated ' + action + ' returns ALREADY_USED with original timestamp')
    }
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => invoke(admin, 'admit', second.qrCredential)))
    check(concurrent.filter(r => r.result === 'ADMITTED').length === 1 && concurrent.filter(r => r.result === 'ALREADY_USED').length === 5, 'Six concurrent HTTP redemptions produce exactly one success')
    const after = await invoke(admin, 'dashboard')
    check(after.total === before.total && after.admitted === before.admitted + 2 && after.remaining === before.remaining - 2, 'Real dashboard totals reflect exactly two admissions')
    check([first.id, second.id].every(id => after.recent.some(item => item.id === id && item.redeemedBy === adminId)), 'Recent activity includes the new test admissions and actor')
    const recovery = await guest.functions.invoke('guest-ticket', { body: { action: 'lookup' } })
    check(!recovery.error && recovery.data.ticket.id === first.id && recovery.data.ticket.status === 'redeemed' && recovery.data.ticket.qrCredential === null, 'Phase 2 guest recovery preserves ticket and suppresses redeemed QR')
    return {
      report: { checks, testRun: run, testOwnerIds: guestOwners, testTicketIds: [first.id, second.id], adminId },
      async verifyRevoked() {
        check(await deny(admin, 'dashboard'), 'Revoked allowlist denies an already-authenticated admin')
        for (const client of clients) await client.auth.signOut({ scope: 'local' })
        check(storage.get('halloween-mazoxi:auth:v1') == null, 'Test sessions can sign out without mixing identities')
        return { checks, testRun: run }
      },
    }
  } catch {
    for (const client of clients) { try { await client.auth.signOut({ scope: 'local' }) } catch { /* No secrets logged. */ } }
    throw Error('Phase 3 live tests failed. Completed checks: ' + checks.join('; ') + '. Test owner IDs: ' + guestOwners.join(','))
  }
}
