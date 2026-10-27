import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signInAnonymously: vi.fn(), refreshSession: vi.fn(), invoke: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({ getSupabase: async () => ({ auth: mocks, functions: { invoke: mocks.invoke } }) }))
const returnedTicket = {
  id: 'ticket', ownerId: 'owner', editionId: 'cauldron', displayNumber: 'HM-1',
  status: 'issued', createdAt: '2026-10-27T00:00:00Z', redeemedAt: null, qrCredential: 'hm1_' + 'B'.repeat(43),
}
beforeEach(() => { vi.resetModules(); vi.resetAllMocks() })
describe('guest client session and duplicate request handling', () => {
  it('restores without creating an anonymous account on initial unclaimed page load', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const { loadGuestTicket } = await import('../src/lib/guestTickets')
    expect(await loadGuestTicket()).toBeNull()
    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
  it('coalesces double-clicks, creates one anonymous session and returns the verified ticket', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null }).mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null })
    mocks.signInAnonymously.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null })
    mocks.invoke.mockResolvedValue({ data: { ticket: returnedTicket }, error: null })
    const { claimGuestTicket } = await import('../src/lib/guestTickets')
    const [a, b] = await Promise.all([claimGuestTicket(), claimGuestTicket()])
    expect(a).toEqual(b)
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })
  it('recovery uses lookup and preserves the credential without a new sign-in', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null })
    mocks.invoke.mockResolvedValue({ data: { ticket: returnedTicket }, error: null })
    const { loadGuestTicket } = await import('../src/lib/guestTickets')
    expect(await loadGuestTicket()).toEqual(returnedTicket)
    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
    expect(mocks.invoke).toHaveBeenCalledWith('guest-ticket', { body: { action: 'lookup' }, timeout: 20000 })
  })
  it('does not create a fresh identity after a session error', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: new Error('network') })
    const { claimGuestTicket } = await import('../src/lib/guestTickets')
    await expect(claimGuestTicket()).rejects.toThrow()
    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
  })
})
