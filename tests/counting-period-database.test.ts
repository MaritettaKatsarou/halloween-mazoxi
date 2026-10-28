import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { prepareRealtimeSchema } from './helpers/realtime'
import type { AdminDashboard, AdmissionResult, CountingHistory, ResetCountResult } from '../supabase/functions/_shared/admin-handler'
import { exactAdmissionTime } from '../src/admin/time'

let db: PGlite, legacyBaseline: string, first: ResetCountResult, second: ResetCountResult
const admin = randomUUID(), guest = randomUUID(), denied = randomUUID()
const tokens: string[] = []
const nonce = randomUUID()
async function rpc<T>(sql: string, args: unknown[]) {
  return db.transaction(async tx => { await tx.exec('set local role service_role'); return (await tx.query<{ value: T }>(sql, args)).rows[0].value })
}
const dashboard = () => rpc<AdminDashboard>('select public.admin_ticket_action($1,\'dashboard\',null) as value', [admin])
const admit = (token: string) => rpc<AdmissionResult>('select public.admin_ticket_action($1,\'admit\',$2) as value', [admin, token])
const reset = (requestId = randomUUID()) => rpc<ResetCountResult>('select public.reset_admission_count($1,$2) as value', [admin, requestId])
const history = (before: string | null = null, actor = admin) => rpc<CountingHistory>('select public.admin_counting_history($1,$2) as value', [actor, before])
async function issue() {
  const owner = randomUUID(); await db.query('insert into auth.users(id) values($1)', [owner])
  const ticket = await rpc<{ id: string; qrCredential: string }>('select public.issue_guest_ticket($1,true) as value', [owner])
  tokens.push(ticket.qrCredential); return ticket
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean default true,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`)
  await prepareRealtimeSchema(db)
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()
  const snapshotIndex = files.findIndex(file => file.endsWith('_counting_period_snapshots.sql'))
  for (const file of files.slice(0, snapshotIndex)) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.query('insert into auth.users(id,is_anonymous,email,email_confirmed_at) values($1,false,$2,now()),($3,true,null,null),($4,false,$5,now())', [admin, 'fixture@example.invalid', guest, denied, 'denied@example.invalid'])
  await db.query('insert into private.admin_users(user_id) values($1),($2)', [admin, guest])
  await issue(); await issue(); await issue(); await admit(tokens[0])
  legacyBaseline = (await db.query<{ baseline_at: string }>('insert into private.admission_count_resets(request_id,reset_by) values($1,$2) returning baseline_at::text', [randomUUID(), admin])).rows[0].baseline_at
  for (const file of files.slice(snapshotIndex)) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
})
afterAll(async () => { await db?.close() })

describe('immutable counting periods with preserved legacy history', () => {
  it('migration preserves the existing baseline, leaves its snapshot unavailable and does not reset', async () => {
    const data = await history(), current = await dashboard()
    expect(data.periods).toHaveLength(1)
    expect(data.periods[0].snapshot).toBeNull()
    expect(Date.parse(data.periods[0].closedAt)).toBe(Date.parse(legacyBaseline))
    expect([current.total, current.admitted, current.remaining]).toEqual([0, 0, 0])
    expect(data.lifetime).toEqual({ generated: 3, admitted: 1, outstanding: 2 })
  })
  it('new issuance increments Generated and Waiting; its admission increments Admitted and decrements Waiting', async () => {
    await issue(); expect([(await dashboard()).total, (await dashboard()).remaining]).toEqual([1, 1])
    await admit(tokens[3]); const data = await dashboard()
    expect([data.total, data.admitted, data.remaining]).toEqual([1, 1, 0])
  })
  it('older valid admissions may exceed Generated and never make Waiting negative; used codes stay used', async () => {
    expect((await admit(tokens[1])).result).toBe('ADMITTED')
    expect((await admit(tokens[0])).result).toBe('ALREADY_USED')
    const data = await dashboard()
    expect([data.total, data.admitted, data.remaining]).toEqual([1, 2, 0])
    expect([data.lifetimeGenerated, data.lifetimeAdmitted, data.lifetimeRemaining]).toEqual([4, 3, 1])
  })
  it('the first new reset captures accurate immutable period/edition/lifetime statistics without modifying tickets', async () => {
    const tickets = (await db.query('select * from public.tickets order by id')).rows
    const credentials = (await db.query('select * from private.ticket_credentials order by ticket_id')).rows
    first = await reset(nonce)
    expect([first.period.total, first.period.admitted, first.period.remaining]).toEqual([0, 0, 0])
    expect((await db.query('select * from public.tickets order by id')).rows).toEqual(tickets)
    expect((await db.query('select * from private.ticket_credentials order by ticket_id')).rows).toEqual(credentials)
    const closed = (await history()).periods[0]
    expect(Date.parse(closed.periodStart!)).toBe(Date.parse(legacyBaseline))
    expect(closed.closedAt).toBe(first.baselineAt)
    expect(closed.resetBy).toBe(admin)
    expect(closed.snapshot).toMatchObject({ total: 1, admitted: 2, remaining: 0, lifetimeGenerated: 4, lifetimeAdmitted: 3, lifetimeRemaining: 1 })
    expect(closed.snapshot!.distribution.reduce((sum, row) => sum + row.total, 0)).toBe(1)
    expect(closed.snapshot!.distribution.reduce((sum, row) => sum + row.admitted, 0)).toBe(2)
  })
  it('later admissions leave the closed snapshot unchanged; a second reset closes the next period', async () => {
    const snapshot = (await history()).periods[0]
    await admit(tokens[2]); await issue()
    expect([(await dashboard()).total, (await dashboard()).admitted, (await dashboard()).remaining]).toEqual([1, 1, 1])
    expect((await history()).periods[0]).toEqual(snapshot)
    second = await reset()
    expect([second.period.total, second.period.admitted, second.period.remaining]).toEqual([0, 0, 0])
    const closed = (await history()).periods[0]
    expect(closed.periodStart).toBe(first.baselineAt)
    expect(closed.snapshot).toMatchObject({ total: 1, admitted: 1, remaining: 1 })
    await admit(tokens[4])
    expect((await history()).periods[0]).toEqual(closed)
    expect((await dashboard()).remaining).toBe(0)
  })
  it('lost-response retries and concurrent duplicate requests create no duplicate snapshot or unwanted baseline', async () => {
    const before = await history()
    await reset(nonce)
    expect((await history()).periods).toEqual(before.periods)
    expect((await dashboard()).baselineAt).toBe(second.baselineAt)
    const key = randomUUID(), results = await Promise.all(Array.from({ length: 5 }, () => reset(key)))
    expect(new Set(results.map(result => result.resetId)).size).toBe(1)
    expect((await history()).periods).toHaveLength(before.periods.length + 1)
  })
  it('half-open timestamp boundaries assign exact-boundary issues and admissions to the new period only', async () => {
    await db.transaction(async tx => {
      const row = (await tx.query<{ id: string }>('select id from public.tickets limit 1')).rows[0]
      await tx.query('update public.tickets set created_at=$1,redeemed_at=$1,status=\'redeemed\' where id=$2', [second.baselineAt, row.id])
      await tx.exec('set local role service_role')
      const end = (await tx.query<{ value: { total: number } }>('select private.counting_period_stats(null,$1) as value', [second.baselineAt])).rows[0].value
      const start = (await tx.query<{ value: { total: number; admitted: number } }>('select private.counting_period_stats($1,null) as value', [second.baselineAt])).rows[0].value
      expect(end.total + start.total).toBe(5)
      expect(start.total).toBeGreaterThanOrEqual(1)
      expect(start.admitted).toBeGreaterThanOrEqual(1)
      // This local fixture update is rolled back explicitly below.
      throw new Error('ROLLBACK_BOUNDARY_FIXTURE')
    }).catch(error => { if (error.message !== 'ROLLBACK_BOUNDARY_FIXTURE') throw error })
  })
  it('archives every reset with paginated access and no fabricated legacy snapshots', async () => {
    for (let i = 0; i < 21; i++) await reset()
    const page = await history(), next = await history(page.nextBeforeId)
    expect(page.periods).toHaveLength(20)
    expect(next.periods).toHaveLength(5)
    expect(new Set([...page.periods, ...next.periods].map(item => item.id)).size).toBe(25)
    expect(next.periods.at(-1)?.snapshot).toBeNull()
    expect(next.nextBeforeId).toBeNull()
  })
  it('uses Europe/Athens time including seconds and the correct DST offset', () => {
    expect(exactAdmissionTime('2026-10-28T13:10:16.097148Z')).toMatch(/15:10:16/)
  })
  it('denies guest, unlisted or revoked admins and prevents direct snapshot modification', async () => {
    for (const actor of [guest, denied]) await expect(history(null, actor)).rejects.toThrow('Admin access required')
    await db.query('update private.admin_users set enabled=false where user_id=$1', [admin])
    await expect(history()).rejects.toThrow('Admin access required')
    await db.query('update private.admin_users set enabled=true where user_id=$1', [admin])
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec('update private.admission_count_resets set snapshot=\'{}\'::jsonb') })).rejects.toThrow(/permission denied/)
    }
    for (const role of ['anon', 'authenticated']) await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query('select public.admin_counting_history($1,null)', [admin]) })).rejects.toThrow(/permission denied/)
  })
})
