import { describe, expect, it, vi } from 'vitest'
import { AdminDenied, createAdminHandler } from '../supabase/functions/_shared/admin-handler'
import type { AdminDependencies } from '../supabase/functions/_shared/admin-handler'
const request = (body: unknown) => new Request('https://test/admin-ticket', { method: 'POST', headers: { Authorization: 'Bearer auth-session' }, body: JSON.stringify(body) })
describe('admin Edge trust boundary', () => {
  it('denies guests before touching the private backend', async () => {
    const execute = vi.fn()
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'guest', permanent: false }), execute })
    expect((await handler(request({ action: 'admit', credential: 'hm1_' + 'A'.repeat(43) }))).status).toBe(403)
    expect(execute).not.toHaveBeenCalled()
  })
  it('rechecks trusted allowlisting and never trusts client identity/roles', async () => {
    const execute = vi.fn(async () => { throw new AdminDenied() })
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'server-user', permanent: true }), execute })
    expect((await handler(request({ action: 'dashboard' }))).status).toBe(403)
    expect(execute).toHaveBeenCalledWith('server-user', 'session')
  })
  it('rejects malformed tokens and attempts to supply admin IDs, editions or statuses', async () => {
    const execute = vi.fn<AdminDependencies['execute']>(async () => ({ authorized: true }))
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'admin', permanent: true }), execute })
    expect(await (await handler(request({ action: 'validate', credential: 'HM-1' }))).json()).toEqual({ result: 'INVALID' })
    expect((await handler(request({ action: 'admit', adminId: 'attacker' }))).status).toBe(400)
    expect(execute.mock.calls.every(args => args[1] === 'session')).toBe(true)
  })
  it('validation and admission are separate authenticated operations; every action rechecks authorization', async () => {
    const execute = vi.fn<AdminDependencies['execute']>(async () => ({ result: 'VALID' }))
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'admin', permanent: true }), execute })
    const token = 'hm1_' + 'A'.repeat(43)
    await handler(request({ action: 'validate', credential: token }))
    expect(execute).toHaveBeenLastCalledWith('admin', 'validate', token)
    expect(execute).not.toHaveBeenCalledWith('admin', 'admit', token)
    await handler(request({ action: 'admit', credential: token }))
    expect(execute).toHaveBeenLastCalledWith('admin', 'admit', token)
    expect(execute.mock.calls.filter(args => args[1] === 'session')).toHaveLength(2)
  })
  it('invalid sessions and backend errors never disclose credentials', async () => {
    const handler = createAdminHandler({ authenticate: async () => null, execute: vi.fn() })
    expect((await handler(request({ action: 'dashboard' }))).status).toBe(401)
    const failed = await createAdminHandler({ authenticate: async () => { throw Error('private detail') }, execute: vi.fn() })(request({ action: 'dashboard' }))
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private detail')
  })
  it('authorizes resets freshly, requires an idempotency UUID and never accepts a client baseline', async () => {
    const execute = vi.fn<AdminDependencies['execute']>(async () => ({ authorized: true }))
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'admin', permanent: true }), execute })
    const requestId = '00000000-0000-4000-8000-000000000001'
    expect((await handler(request({ action: 'reset-count', requestId }))).status).toBe(200)
    expect(execute).toHaveBeenLastCalledWith('admin', 'reset-count', undefined, { requestId })
    expect(execute.mock.calls[0]).toEqual(['admin', 'session'])
    for (const body of [{ action: 'reset-count' }, { action: 'reset-count', requestId: 'bad' },
      { action: 'reset-count', requestId, baselineAt: '2026-10-31' },
      { action: 'reset-count', requestId, credential: 'HM-1' }, { action: 'admit', requestId }]) {
      expect((await handler(request(body))).status).toBe(400)
    }
    const guest = createAdminHandler({ authenticate: async () => ({ id: 'guest', permanent: false }), execute })
    const denied = createAdminHandler({ authenticate: async () => ({ id: 'revoked', permanent: true }), execute: async () => { throw new AdminDenied() } })
    expect((await guest(request({ action: 'reset-count', requestId }))).status).toBe(403)
    expect((await denied(request({ action: 'reset-count', requestId }))).status).toBe(403)
  })
  it('only accepts bounded, typed history cursors after authorization', async () => {
    const execute = vi.fn<AdminDependencies['execute']>(async () => ({}))
    const handler = createAdminHandler({ authenticate: async () => ({ id: 'admin', permanent: true }), execute })
    const cursor = { id: '00000000-0000-4000-8000-000000000001', redeemedAt: '2026-10-31T18:00:00.123456+00:00' }
    expect((await handler(request({ action: 'history', cursor }))).status).toBe(200)
    expect(execute).toHaveBeenLastCalledWith('admin', 'history', undefined, { cursor })
    for (const value of [null, {}, { ...cursor, id: 'bad' }, { ...cursor, redeemedAt: 'invalid' }, { ...cursor, admin: 'attacker' }]) {
      expect((await handler(request({ action: 'history', cursor: value }))).status).toBe(400)
    }
  })
})
