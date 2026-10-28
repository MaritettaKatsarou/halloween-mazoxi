import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import collection from '../src/config/ticket-collection.json'
import type { AdminDashboard, AdmissionResult, AdminHistory, ResetCountResult } from '../supabase/functions/_shared/admin-handler'
import { prepareRealtimeSchema } from './helpers/realtime'

let db: PGlite
const admin = randomUUID(), denied = randomUUID(), guest = randomUUID()
const credentials: string[] = []
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean default true, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated;`)
  await prepareRealtimeSchema(db)
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.query('insert into auth.users(id,is_anonymous,email,email_confirmed_at) values($1,false,$2,now()),($3,false,$4,now()),($5,true,null,null)', [admin, 'host@example.invalid', denied, 'other@example.invalid', guest])
  await db.query('insert into private.admin_users(user_id) values($1),($2)', [admin, guest])
  // Deliberately test every original edition, using the unmodified issuer then
  // assigning its local fixture row. No hosted artwork assignments are altered.
  for (const edition of collection.editions) {
    const owner = randomUUID()
    await db.query('insert into auth.users(id) values($1)', [owner])
    const value = await db.transaction(async tx => {
      await tx.exec('set local role service_role')
      return (await tx.query<{ ticket: { id: string; qrCredential: string } }>('select public.issue_guest_ticket($1,true) as ticket', [owner])).rows[0].ticket
    })
    await db.query('update public.tickets set edition_id=$1 where id=$2', [edition.id, value.id])
    credentials.push(value.qrCredential)
  }
})

async function reset(actor: string, nonce = randomUUID()) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query<{ value: ResetCountResult }>('select public.reset_admission_count($1,$2) as value', [actor, nonce])).rows[0].value
  })
}
async function history(cursor: AdminHistory['nextCursor'] = null) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query<{ value: AdminHistory }>('select public.admin_admission_history($1,$2,$3) as value', [admin, cursor?.redeemedAt ?? null, cursor?.id ?? null])).rows[0].value
  })
}

afterAll(async () => { await db?.close() })
async function action<T>(actor: string, operation: string, credential: string | null = null) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query<{ value: T }>('select public.admin_ticket_action($1,$2,$3) as value', [actor, operation, credential])).rows[0].value
  })
}
describe('admin database authorization and one-time admission', () => {
  it('denies non-allowlisted permanent users and even accidentally allowlisted anonymous users', async () => {
    await expect(action(denied, 'dashboard')).rejects.toThrow('Admin access required')
    await expect(action(guest, 'admit', credentials[0])).rejects.toThrow('Admin access required')
  })
  it('rejects invalid tokens without revealing any ticket information', async () => {
    expect(await action(admin, 'validate', 'HM-1')).toEqual({ result: 'INVALID' })
    expect(await action(admin, 'admit', 'hm1_' + 'Z'.repeat(43))).toEqual({ result: 'INVALID' })
  })
  it('validates all 12 editions without redeeming them', async () => {
    for (const [index, credential] of credentials.entries()) {
      const result = await action<AdmissionResult>(admin, 'validate', credential)
      expect(result.result).toBe('VALID')
      if (result.result !== 'INVALID') {
        expect(result.ticket.editionId).toBe(collection.editions[index].id)
        expect(result.ticket.redeemedAt).toBeNull()
        expect(Object.keys(result.ticket)).not.toContain('qrCredential')
      }
    }
    const dashboard = await action<AdminDashboard>(admin, 'dashboard')
    expect([dashboard.total, dashboard.admitted, dashboard.remaining]).toEqual([12, 0, 12])
    expect(dashboard.distribution).toHaveLength(12)
  })
  it('first redemption wins, second returns original timestamp and no further mutation', async () => {
    const first = await action<AdmissionResult>(admin, 'admit', credentials[0])
    expect(first.result).toBe('ADMITTED')
    if (first.result === 'INVALID') throw Error('Missing ticket')
    expect(first.ticket.redeemedBy).toBe(admin)
    expect(first.ticket.redeemedAt).not.toBeNull()
    for (const operation of ['validate', 'admit']) {
      const second = await action<AdmissionResult>(admin, operation, credentials[0])
      expect(second.result).toBe('ALREADY_USED')
      if (second.result !== 'INVALID') expect(second.ticket).toEqual(first.ticket)
    }
    const dashboard = await action<AdminDashboard>(admin, 'dashboard')
    expect([dashboard.total, dashboard.admitted, dashboard.remaining]).toEqual([12, 1, 11])
    expect(dashboard.recent[0].id).toBe(first.ticket.id)
  })
  it('concurrent invocations produce one success; hosted tests additionally check separate HTTP/database transactions', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => action<AdmissionResult>(admin, 'admit', credentials[1])))
    expect(results.filter(r => r.result === 'ADMITTED')).toHaveLength(1)
    expect(results.filter(r => r.result === 'ALREADY_USED')).toHaveLength(4)
  })
  it('revocation denies the next protected operation', async () => {
    await db.query('update private.admin_users set enabled=false where user_id=$1', [admin])
    await expect(action(admin, 'dashboard')).rejects.toThrow('Admin access required')
    await db.query('update private.admin_users set enabled=true where user_id=$1', [admin])
  })
  for (const role of ['anon', 'authenticated']) {
    it(`${role} cannot invoke admin SQL, change admission or authorize itself`, async () => {
      for (const sql of [
        `select public.admin_ticket_action('${admin}','dashboard',null)`,
        'select * from private.admin_users',
        `insert into private.admin_users(user_id) values('${denied}')`,
        `update public.tickets set status='redeemed',redeemed_at=now(),redeemed_by='${guest}'`,
      ]) await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec(sql) })).rejects.toThrow(/permission denied/)
    })
  }
})

describe('persistent admission counting baseline (disposable local fixtures only)', () => {
  const nonce = randomUUID()
  let initialReset: ResetCountResult
  it('migration never creates a baseline; initial metrics retain all-time behavior', async () => {
    expect((await db.query('select * from private.admission_count_resets')).rows).toHaveLength(0)
    const dashboard = await action<AdminDashboard>(admin, 'dashboard')
    expect(dashboard.baselineAt).toBeNull()
    expect([dashboard.admitted, dashboard.lifetimeAdmitted, dashboard.remaining]).toEqual([2, 2, 10])
  })
  it('denies unlisted, revoked, and anonymous actors without adding audit records', async () => {
    await expect(reset(denied)).rejects.toThrow('Admin access required')
    await expect(reset(guest)).rejects.toThrow('Admin access required')
    await db.query('update private.admin_users set enabled=false where user_id=$1', [admin])
    await expect(reset(admin)).rejects.toThrow('Admin access required')
    await db.query('update private.admin_users set enabled=true where user_id=$1', [admin])
    expect((await db.query('select * from private.admission_count_resets')).rows).toHaveLength(0)
  })
  it('a reset preserves every ticket and credential while only resetting the admission view', async () => {
    const tickets = (await db.query('select * from public.tickets order by id')).rows
    const credentials = (await db.query('select * from private.ticket_credentials order by ticket_id')).rows
    initialReset = await reset(admin, nonce)
    expect((await db.query('select * from public.tickets order by id')).rows).toEqual(tickets)
    expect((await db.query('select * from private.ticket_credentials order by ticket_id')).rows).toEqual(credentials)
    const dashboard = await action<AdminDashboard>(admin, 'dashboard')
    expect(dashboard.baselineAt).toBe(initialReset.baselineAt)
    expect([dashboard.total, dashboard.admitted, dashboard.lifetimeAdmitted, dashboard.remaining]).toEqual([12, 0, 2, 10])
    expect(dashboard.recent).toEqual([])
    expect(dashboard.distribution.reduce((sum, row) => sum + row.total, 0)).toBe(12)
    expect(dashboard.distribution.every(row => row.admitted === 0)).toBe(true)
    const audit = (await db.query<{ reset_by: string }>('select reset_by from private.admission_count_resets')).rows
    expect(audit).toEqual([{ reset_by: admin }])
    expect((await history()).items).toHaveLength(2)
  })
  it('pre-reset issued tickets admitted afterward count 1 then 2; used QR scans never count again', async () => {
    for (const [index, expected] of [[2, 1], [3, 2]]) {
      expect((await action<AdmissionResult>(admin, 'admit', credentials[index])).result).toBe('ADMITTED')
      const dashboard = await action<AdminDashboard>(admin, 'dashboard')
      expect(dashboard.admitted).toBe(expected)
      expect(dashboard.remaining).toBe(10 - expected)
      expect(dashboard.recent).toHaveLength(expected)
      expect(dashboard.distribution.reduce((sum, row) => sum + row.admitted, 0)).toBe(expected)
    }
    for (const token of [credentials[0], credentials[2]]) {
      expect((await action<AdmissionResult>(admin, 'validate', token)).result).toBe('ALREADY_USED')
      expect((await action<AdmissionResult>(admin, 'admit', token)).result).toBe('ALREADY_USED')
    }
    expect((await action<AdminDashboard>(admin, 'dashboard')).admitted).toBe(2)
    expect((await history()).items).toHaveLength(4)
  })
  it('idempotent retry does not advance the baseline or discard arrivals; further resets retain the audit trail', async () => {
    expect(await reset(admin, nonce)).toEqual(initialReset)
    expect((await action<AdminDashboard>(admin, 'dashboard')).admitted).toBe(2)
    const second = await reset(admin)
    expect(second.resetId).not.toBe(initialReset.resetId)
    expect((await history()).resets).toHaveLength(2)
    expect((await action<AdminDashboard>(admin, 'dashboard')).admitted).toBe(0)
    await reset(admin, nonce)
    expect((await action<AdminDashboard>(admin, 'dashboard')).baselineAt).toBe(second.baselineAt)
  })
  it('concurrent duplicate reset requests save exactly one audit record', async () => {
    const requestId = randomUUID()
    const results = await Promise.all(Array.from({ length: 5 }, () => reset(admin, requestId)))
    expect(new Set(results.map(result => result.resetId)).size).toBe(1)
    expect((await db.query('select * from private.admission_count_resets')).rows).toHaveLength(3)
  })
  it('all historical admissions remain accessible through stable keyset pages', async () => {
    // Add only local synthetic history to exercise more than one page.
    for (let i = 0; i < 21; i++) {
      const owner = randomUUID()
      await db.query('insert into auth.users(id) values($1)', [owner])
      const ticket = await db.transaction(async tx => {
        await tx.exec('set local role service_role')
        return (await tx.query<{ value: { qrCredential: string } }>('select public.issue_guest_ticket($1,true) as value', [owner])).rows[0].value
      })
      await action(admin, 'admit', ticket.qrCredential)
    }
    const first = await history(), second = await history(first.nextCursor)
    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(25)
  })
  for (const role of ['anon', 'authenticated']) it(`${role} cannot read, reset, or modify private counting data`, async () => {
    for (const sql of [
      'select * from private.admission_count_resets',
      `select public.reset_admission_count('${admin}','${randomUUID()}')`,
      `select public.admin_admission_history('${admin}',null,null)`,
      `update private.admission_count_resets set baseline_at=now()`,
      'delete from private.admission_count_resets',
    ]) await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec(sql) })).rejects.toThrow(/permission denied/)
  })
})
