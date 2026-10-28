import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), invoke: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://hefzzwfmpdukwceuwgqr.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-placeholder')
  vi.stubGlobal('window', { sessionStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } })
  mocks.createClient.mockReturnValue({ auth: mocks, functions: { invoke: mocks.invoke } })
  mocks.getSession.mockResolvedValue({ data: { session: { user: { is_anonymous: false } } }, error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: { user: { is_anonymous: false } }, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.invoke.mockResolvedValue({ data: { authorized: true }, error: null })
})
describe('admin client session isolation and login', () => {
  it('uses a separate storage key and sessionStorage while the guest client keeps its original key', async () => {
    await (await import('../src/lib/supabase')).getSupabase()
    await (await import('../src/admin/client')).getAdminClient()
    const options = mocks.createClient.mock.calls.map(call => call[2].auth)
    expect(options[0].storageKey).toBe('halloween-mazoxi:auth:v1')
    expect(options[1].storageKey).toBe('halloween-mazoxi:admin:v1')
    expect(options[1].storage).toBe(window.sessionStorage)
    expect(options[1].detectSessionInUrl).toBe(false)
  })
  it('uses permanent password login, then checks backend authorization', async () => {
    const { signInAdmin } = await import('../src/admin/client')
    await signInAdmin(' host@example.invalid ', 'synthetic-test-password')
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'host@example.invalid', password: 'synthetic-test-password' })
    expect(mocks.invoke).toHaveBeenCalledWith('admin-ticket', { body: { action: 'session' }, timeout: 20000 })
  })
  it('signs an unlisted account out locally after protected authorization fails', async () => {
    mocks.invoke.mockResolvedValue({ error: { context: new Response(null, { status: 403 }) } })
    const { signInAdmin } = await import('../src/admin/client')
    await expect(signInAdmin('other@example.invalid', 'synthetic-test-password')).rejects.toThrow('denied')
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('never upgrades an anonymous session into admin access', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { is_anonymous: true } } }, error: null })
    const { adminRequest } = await import('../src/admin/client')
    await expect(adminRequest('dashboard')).rejects.toThrow('administrator')
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })
  it('admin sign out uses only local scope and does not create a new anonymous session', async () => {
    await (await import('../src/admin/client')).signOutAdmin()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })
  it('sends a confirmed reset request ID unchanged so a retry cannot create a second baseline', async () => {
    const { adminRequest } = await import('../src/admin/client')
    const requestId = '00000000-0000-4000-8000-000000000001'
    await adminRequest('reset-count', undefined, { requestId })
    await adminRequest('reset-count', undefined, { requestId })
    expect(mocks.invoke.mock.calls.map(call => call[1].body)).toEqual([
      { action: 'reset-count', requestId }, { action: 'reset-count', requestId },
    ])
  })
})
