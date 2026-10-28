import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { prepareRealtimeSchema } from './helpers/realtime'
import collection from '../src/config/ticket-collection.json'

type Ticket = { id: string; ownerId: string; editionId: string; qrCredential: string | null; status: string }
type Bag = { cycle: number; next_position: number; edition_order: string[] }
let db: PGlite, previousRows: unknown[], previousCredentials: unknown[], previousResets: unknown[], oldCore: string
const admin = randomUUID(), legacyOwner = randomUUID(), usedOwner = randomUUID()
let usedCredential: string, legacy: Ticket, used: Ticket
const assigned: Ticket[] = []
const expected = collection.editions.map(e => e.id).sort()
async function rpc<T>(sql: string, args: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query<{ value: T }>(sql, args)).rows[0].value
  })
}
const issue = (owner: string, create = true) => rpc<Ticket | null>('select public.issue_guest_ticket($1,$2) as value', [owner, create])
const bag = async () => (await db.query<Bag>('select cycle::int,next_position,edition_order from private.ticket_distribution')).rows[0]
async function claim() {
  const owner = randomUUID()
  await db.query('insert into auth.users(id) values($1)', [owner])
  const ticket = (await issue(owner))!
  assigned.push(ticket)
  return ticket
}
const adminAction = (action: string, token: string | null = null) => rpc<{ result: string }>('select public.admin_ticket_action($1,$2,$3) as value', [admin, action, token])
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean default true,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`)
  await prepareRealtimeSchema(db)
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()
  const migration = files.find(f => f.endsWith('_ticket_shuffle_bag.sql'))!
  for (const file of files.filter(f => f !== migration)) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.query('insert into auth.users(id,is_anonymous,email,email_confirmed_at) values($1,false,$2,now()),($3,true,null,null),($4,true,null,null)', [admin, 'fixture@example.invalid', legacyOwner, usedOwner])
  await db.query('insert into private.admin_users(user_id) values($1)', [admin])
  legacy = (await issue(legacyOwner))!
  used = (await issue(usedOwner))!; usedCredential = used.qrCredential!
  await adminAction('admit', usedCredential)
  await rpc('select public.reset_admission_count($1,$2) as value', [admin, randomUUID()])
  previousRows = (await db.query('select * from public.tickets order by id')).rows
  previousCredentials = (await db.query('select * from private.ticket_credentials order by ticket_id')).rows
  previousResets = (await db.query('select * from private.admission_count_resets order by id')).rows
  oldCore = (await db.query<{ prosrc: string }>("select prosrc from pg_proc where oid='private.issue_guest_ticket_core(uuid,boolean)'::regprocedure")).rows[0].prosrc
  await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'))
})
afterAll(async () => { await db?.close() })

describe('transactional shuffle bag (isolated real Postgres/PGlite)', () => {
  it('starts cycle 1 empty, preserves historical records, and changes only the selection in the issuance core', async () => {
    expect(await bag()).toMatchObject({ cycle: 1, next_position: 1 })
    expect((await db.query('select * from public.tickets order by id')).rows).toEqual(previousRows)
    expect((await db.query('select * from private.ticket_credentials order by ticket_id')).rows).toEqual(previousCredentials)
    expect((await db.query('select * from private.admission_count_resets order by id')).rows).toEqual(previousResets)
    const core = (await db.query<{ prosrc: string }>("select prosrc from pg_proc where oid='private.issue_guest_ticket_core(uuid,boolean)'::regprocedure")).rows[0].prosrc
    expect(core).toBe(oldCore.replace(/ {4}select id into selected_edition from private\.ticket_editions\s+where enabled order by random\(\) limit 1;\s+if selected_edition is null then raise exception 'No editions available'; end if;/, '    selected_edition := private.draw_ticket_edition();'))
  })
  it('first 12 successful claims contain exactly all 12 original editions', async () => {
    for (let i = 0; i < 12; i++) await claim()
    expect(assigned.map(t => t.editionId).sort()).toEqual(expected)
    expect(await bag()).toMatchObject({ cycle: 1, next_position: 13 })
    expect(new Set(assigned.map(t => t.qrCredential)).size).toBe(12)
  })
  it('claims 13–24 repeat the complete collection once, and claim 25 starts cycle 3', async () => {
    for (let i = 0; i < 12; i++) await claim()
    expect(assigned.slice(12, 24).map(t => t.editionId).sort()).toEqual(expected)
    expect(await bag()).toMatchObject({ cycle: 2, next_position: 13 })
    await claim()
    expect(await bag()).toMatchObject({ cycle: 3, next_position: 2 })
    expect(expected).toContain(assigned[24].editionId)
  })
  it('retries and lookup restore existing identity/credential without consuming slots, including legacy tickets', async () => {
    const before = await bag()
    for (const ticket of [legacy, assigned[0], assigned[24]]) {
      expect(await issue(ticket.ownerId)).toEqual(ticket)
      expect(await issue(ticket.ownerId, false)).toEqual(ticket)
    }
    expect(await issue(randomUUID(), false)).toBeNull()
    expect(await issue(usedOwner)).toMatchObject({ id: used.id, editionId: used.editionId, status: 'redeemed', qrCredential: null })
    expect((await adminAction('validate', usedCredential)).result).toBe('ALREADY_USED')
    expect(await bag()).toEqual(before)
  })
  it('new cycles are shuffled permutations and all assigned editions map to original artwork', async () => {
    while (assigned.length < 48) await claim()
    const orders = [0, 12, 24, 36].map(start => assigned.slice(start, start + 12).map(t => t.editionId))
    for (const order of orders) expect([...order].sort()).toEqual(expected)
    expect(new Set(orders.map(order => order.join(','))).size).toBeGreaterThan(1)
    for (const ticket of assigned) expect(collection.editions.find(e => e.id === ticket.editionId)?.file).toMatch(/\.png$/)
  })
  it('a failed insert at rollover rolls back both the new permutation and cursor', async () => {
    const before = await bag()
    expect(before.next_position).toBe(13)
    await expect(issue(randomUUID())).rejects.toThrow(/foreign key/)
    expect(await bag()).toEqual(before)
    expect((await db.query<{ n: number }>('select count(*)::int as n from public.tickets')).rows[0].n).toBe(50)
    await claim()
    expect(await bag()).toMatchObject({ cycle: 5, next_position: 2 })
  })
  it('credential insertion failure rolls back ticket insertion and slot consumption', async () => {
    const owner = randomUUID(), before = await bag()
    await db.query('insert into auth.users(id) values($1)', [owner])
    await expect(db.transaction(async tx => {
      await tx.exec(`create function pg_temp.reject_credential() returns trigger language plpgsql as $$begin raise exception 'Synthetic credential insert failure';end;$$;
        create trigger reject_credential before insert on private.ticket_credentials for each row execute function pg_temp.reject_credential();set local role service_role;`)
      await tx.query('select public.issue_guest_ticket($1,true)', [owner])
    })).rejects.toThrow('Synthetic credential insert failure')
    expect(await bag()).toEqual(before)
    expect(await issue(owner, false)).toBeNull()
    expect((await issue(owner))!.editionId).toBe(before.edition_order[before.next_position - 1])
  })
  it('catalog/queue configuration errors fail closed and preserve the next slot', async () => {
    const before = await bag()
    for (const statement of [
      "update private.ticket_editions set enabled=false where id='cauldron'",
      "insert into private.ticket_editions(id) values('not-an-artwork')",
      "update private.ticket_distribution set edition_order=array_fill('cauldron'::text,array[12])",
    ]) {
      await expect(db.transaction(async tx => {
        await tx.exec(statement); await tx.exec('set local role service_role')
        await tx.query('select public.issue_guest_ticket($1,true)', [randomUUID()])
      })).rejects.toThrow('Shuffle bag catalog mismatch')
      expect(await bag()).toEqual(before)
    }
  })
  it('RESET COUNT and History do not change distribution state; admission still sends only trusted minimal events', async () => {
    const before = await bag()
    await rpc('select public.reset_admission_count($1,$2) as value', [admin, randomUUID()])
    await rpc('select public.admin_counting_history($1,null) as value', [admin])
    expect((await adminAction('validate', assigned[0].qrCredential)).result).toBe('VALID')
    expect((await adminAction('admit', assigned[0].qrCredential)).result).toBe('ADMITTED')
    expect((await adminAction('admit', assigned[0].qrCredential)).result).toBe('ALREADY_USED')
    const events = (await db.query<{ payload: { ticketId: string } }>('select payload from realtime.messages')).rows
    expect(events.at(-1)?.payload).toEqual({ ticketId: assigned[0].id })
    expect(await bag()).toEqual(before)
  })
  it('guests cannot inspect/manipulate distribution state or invoke issuance/draw functions', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const statement of ['select * from private.ticket_distribution', 'update private.ticket_distribution set next_position=1', 'select private.draw_ticket_edition()', `select public.issue_guest_ticket('${legacyOwner}',true)`]) {
        await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec(statement) })).rejects.toThrow(/permission denied/)
      }
    }
    const flags = (await db.query<{ secure: boolean }>(`select bool_and(not prosecdef and proconfig=array['search_path=""']) as secure from pg_proc where oid in ('private.draw_ticket_edition()'::regprocedure,'private.issue_guest_ticket_core(uuid,boolean)'::regprocedure)`)).rows[0]
    expect(flags.secure).toBe(true)
    await expect(db.transaction(async tx => { await tx.exec("set local role service_role;update private.ticket_distribution set activated_at=now()") })).rejects.toThrow(/permission denied/)
  })
})
