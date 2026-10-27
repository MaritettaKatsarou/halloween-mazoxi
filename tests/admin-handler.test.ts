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
})
