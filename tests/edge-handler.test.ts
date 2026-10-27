import { describe, expect, it, vi } from 'vitest'
import { createGuestHandler } from '../supabase/functions/_shared/guest-handler'

const request = (body = { action: 'claim' } as unknown, token = 'verified-user') => new Request('https://test/guest-ticket', {
  method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
})
describe('Edge Function trust boundary', () => {
  it('validates the session and only uses the server-verified owner', async () => {
    const issue = vi.fn(async () => null)
    const authenticate = vi.fn(async () => ({ id: 'owner-from-auth', isAnonymous: true }))
    const response = await createGuestHandler({ authenticate, issue })(request())
    expect(response.status).toBe(200)
    expect(authenticate).toHaveBeenCalledWith('verified-user')
    expect(issue).toHaveBeenCalledWith('owner-from-auth', true)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
  it('lookup cannot issue, and caller-supplied owner or edition is rejected', async () => {
    const issue = vi.fn(async () => null)
    const handler = createGuestHandler({ authenticate: async () => ({ id: 'owner', isAnonymous: true }), issue })
    expect((await handler(request({ action: 'lookup' }))).status).toBe(200)
    expect(issue).toHaveBeenCalledWith('owner', false)
    issue.mockClear()
    expect((await handler(request({ action: 'claim', ownerId: 'victim', editionId: 'cauldron' }))).status).toBe(400)
    expect(issue).not.toHaveBeenCalled()
  })
  it('rejects invalid and non-anonymous sessions before database access', async () => {
    const issue = vi.fn(async () => null)
    expect((await createGuestHandler({ authenticate: async () => null, issue })(request())).status).toBe(401)
    expect((await createGuestHandler({ authenticate: async () => ({ id: 'user', isAnonymous: false }), issue })(request())).status).toBe(403)
    expect(issue).not.toHaveBeenCalled()
  })
  it('hides backend error details and supports unauthenticated CORS preflight', async () => {
    const handler = createGuestHandler({ authenticate: async () => { throw Error('private details') }, issue: async () => null })
    const failed = await handler(request())
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private details')
    expect((await handler(new Request('https://test', { method: 'OPTIONS' }))).status).toBe(204)
    expect((await handler(new Request('https://test', { method: 'POST' }))).status).toBe(401)
    expect((await handler(new Request('https://test'))).status).toBe(405)
  })
})
