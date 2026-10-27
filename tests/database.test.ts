import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import collection from '../src/config/ticket-collection.json'

const sql = readFileSync(new URL('../supabase/migrations/20261027171304_ticket_issuance.sql', import.meta.url), 'utf8')
let db: PGlite
const ownerA = randomUUID(), ownerB = randomUUID()
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${ownerA}'), ('${ownerB}');`)
  await db.exec(sql)
})
afterAll(async () => { await db?.close() })

async function issue(owner: string, create: boolean) {
  return db.transaction(async tx => {
    await tx.exec('set local role service_role')
    const result = await tx.query<{ ticket: { id: string; editionId: string; qrCredential: string | null; status: string } | null }>(
      'select public.issue_guest_ticket($1::uuid, $2) as ticket', [owner, create])
    return result.rows[0].ticket
  })
}
describe('real Postgres migration and permissions (local PGlite)', () => {
  it('lookup creates no ticket; claim and recovery return the same identity, edition and credential', async () => {
    expect(await issue(ownerA, false)).toBeNull()
    const first = await issue(ownerA, true)
    expect(first?.qrCredential).toMatch(/^hm1_[\w-]{43}$/)
    expect(await issue(ownerA, true)).toEqual(first)
    expect(await issue(ownerA, false)).toEqual(first)
  })
  it('different owners receive unique tickets and 256-bit credentials; hash matches the bearer', async () => {
    const a = await issue(ownerA, true), b = await issue(ownerB, true)
    expect(a?.id).not.toBe(b?.id)
    expect(a?.qrCredential).not.toBe(b?.qrCredential)
    const rows = await db.query<{ credential_hash: string }>('select credential_hash from private.ticket_credentials where ticket_id = $1', [a!.id])
    expect(rows.rows[0].credential_hash).toBe(createHash('sha256').update(a!.qrCredential!).digest('hex'))
    expect(Buffer.from(a!.qrCredential!.slice(4), 'base64url').length).toBe(32)
  })
  it('all and only the supplied 12 editions are eligible', async () => {
    const result = await db.query<{ id: string }>('select id from private.ticket_editions where enabled')
    expect(result.rows.map(r => r.id).sort()).toEqual(collection.editions.map(e => e.id).sort())
  })
  it('owner RLS hides other tickets and the public table contains no credential columns', async () => {
    const a = await issue(ownerA, true)
    await db.transaction(async tx => {
      await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${ownerA}'`)
      const own = await tx.query<{ id: string }>('select * from public.tickets')
      expect(own.rows.map(r => r.id)).toEqual([a!.id])
      expect(Object.keys(own.rows[0])).not.toContain('credential')
      expect(Object.keys(own.rows[0])).not.toContain('credential_hash')
    })
  })
  for (const role of ['anon', 'authenticated']) {
    for (const statement of [
      'select * from private.ticket_credentials',
      'select * from private.ticket_editions',
      `select public.issue_guest_ticket('${ownerA}', true)`,
      `insert into public.tickets(owner_id,edition_id) values ('${randomUUID()}', 'cauldron')`,
      `update public.tickets set status = 'redeemed', redeemed_at = now()`,
      `update public.tickets set edition_id = 'cauldron'`,
      `update public.tickets set owner_id = '${ownerB}'`,
      'delete from public.tickets',
    ]) {
      it(`${role} is denied: ${statement.split(' ').slice(0, 4).join(' ')}`, async () => {
        await expect(db.transaction(async tx => {
          await tx.exec(`set local role ${role}; set local request.jwt.claim.sub = '${ownerA}'`)
          await tx.exec(statement)
        })).rejects.toThrow(/permission denied/)
      })
    }
  }
  it('unique owner constraint rejects bypass attempts and redeemed tickets no longer return a usable QR', async () => {
    await expect(db.query('insert into public.tickets(owner_id,edition_id) values ($1, $2)', [ownerA, 'cauldron'])).rejects.toThrow(/unique/)
    await db.query("update public.tickets set status='redeemed', redeemed_at=now() where owner_id=$1", [ownerA])
    const ticket = await issue(ownerA, true)
    expect(ticket?.status).toBe('redeemed')
    expect(ticket?.qrCredential).toBeNull()
  })
})
