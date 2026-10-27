import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { prepareRealtimeSchema } from './helpers/realtime'
let db: PGlite
const owner = randomUUID(), other = randomUUID(), admin = randomUUID()
let ticket: { id: string; qrCredential: string }
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,is_anonymous boolean default true,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`)
  await prepareRealtimeSchema(db)
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.query('insert into auth.users(id,is_anonymous,email,email_confirmed_at) values($1,true,null,null),($2,true,null,null),($3,false,$4,now())', [owner, other, admin, 'test@example.invalid'])
  await db.query('insert into private.admin_users(user_id) values($1)', [admin])
  ticket = await db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return (await tx.query<{ t: { id: string; qrCredential: string } }>('select public.issue_guest_ticket($1,true) as t', [owner])).rows[0].t
  })
})
afterAll(async () => { await db?.close() })
async function action(operation: string) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    return tx.query('select public.admin_ticket_action($1,$2,$3)', [admin, operation, ticket.qrCredential])
  })
}
describe('private admission database Broadcast', () => {
  it('issuance/validation produce no event, and rollback removes both redemption and event', async () => {
    await action('validate')
    expect((await db.query('select * from realtime.messages')).rows).toHaveLength(0)
    await expect(db.transaction(async tx => {
      await tx.exec('set local role service_role')
      await tx.query('select public.admin_ticket_action($1,$2,$3)', [admin, 'admit', ticket.qrCredential])
      throw Error('Deliberate rollback')
    })).rejects.toThrow('Deliberate rollback')
    expect((await db.query('select * from realtime.messages')).rows).toHaveLength(0)
    expect((await db.query<{ status: string }>('select status from public.tickets where id=$1', [ticket.id])).rows[0].status).toBe('issued')
  })
  it('one genuine transition emits one private minimal event; repeat admission emits none', async () => {
    await action('admit'); await action('admit'); await action('validate')
    const events = await db.query<{ topic: string; event: string; payload: unknown; private: boolean }>('select * from realtime.messages')
    expect(events.rows).toHaveLength(1)
    expect(events.rows[0]).toMatchObject({ topic: 'ticket-admission:' + ticket.id, event: 'admitted', payload: { ticketId: ticket.id }, private: true })
  })
  it('only the owner may read their admission topic; malformed/foreign topics and unauthenticated users are denied', async () => {
    for (const [role, actor, topic, expected] of [
      ['authenticated', owner, 'ticket-admission:' + ticket.id, 1],
      ['authenticated', other, 'ticket-admission:' + ticket.id, 0],
      ['authenticated', owner, 'ticket-admission:bad-id', 0],
      ['anon', '', 'ticket-admission:' + ticket.id, 0],
    ] as const) await db.transaction(async tx => {
      await tx.exec(`set local role ${role}`)
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('realtime.topic',$2,true)", [actor, topic])
      expect((await tx.query('select * from realtime.messages')).rows).toHaveLength(expected)
    })
  })
  it('clients cannot insert authoritative events or update ticket status', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(db.transaction(async tx => {
        await tx.exec(`set local role ${role}`)
        await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('realtime.topic',$2,true)", [owner, 'ticket-admission:' + ticket.id])
        await tx.query("insert into realtime.messages(topic,extension,payload,event,private) values($1,'broadcast',$2,'admitted',true)", ['ticket-admission:' + ticket.id, { ticketId: ticket.id }])
      })).rejects.toThrow(/row-level security/)
      await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec("update public.tickets set status='issued'") })).rejects.toThrow(/permission denied/)
    }
  })
})
