import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuestTicket } from '../src/lib/guestTickets'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), setAuth: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), onAuthStateChange: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ getSupabase: async () => ({ auth: mocks, realtime: { setAuth: mocks.setAuth }, channel: mocks.channel, removeChannel: mocks.removeChannel }) }))
import { observeGuestSession, subscribeToAdmission } from '../src/lib/admissionRealtime'
const ticket = { id: 'ticket-a', ownerId: 'owner-a' } as GuestTicket
beforeEach(() => vi.resetAllMocks())
describe('guest-specific private subscription', () => {
  it('uses guest auth, refreshes after every join, filters hints and removes its channel', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: ticket.ownerId }, access_token: 'test-token' } } })
    let receive!: (message: { payload: { ticketId: string } }) => void
    let status!: (status: string) => void
    const channel = { on: vi.fn((_type, _filter, callback) => { receive = callback; return channel }), subscribe: vi.fn(callback => { status = callback; return channel }) }
    mocks.channel.mockReturnValue(channel)
    const notify = vi.fn(), cleanup = await subscribeToAdmission(ticket, notify)
    expect(mocks.setAuth).toHaveBeenCalledWith('test-token')
    expect(mocks.channel).toHaveBeenCalledWith('ticket-admission:ticket-a', { config: { private: true } })
    status('SUBSCRIBED'); status('CHANNEL_ERROR'); status('SUBSCRIBED')
    receive({ payload: { ticketId: 'someone-else' } }); expect(notify).toHaveBeenCalledTimes(2)
    receive({ payload: { ticketId: ticket.id } }); expect(notify).toHaveBeenCalledTimes(3)
    cleanup(); expect(mocks.removeChannel).toHaveBeenCalledWith(channel)
  })
  it('does not subscribe with a missing or different guest identity', async () => {
    for (const session of [null, { user: { id: 'another-owner' } }]) {
      mocks.getSession.mockResolvedValue({ data: { session } })
      const cleanup = await subscribeToAdmission(ticket, vi.fn()); cleanup()
    }
    expect(mocks.channel).not.toHaveBeenCalled()
  })
  it('defers auth notifications outside the auth lock and unsubscribes', async () => {
    let auth!: (event: string, session: { user: { id: string } } | null) => void
    const unsubscribe = vi.fn(), changed = vi.fn()
    mocks.onAuthStateChange.mockImplementation(callback => { auth = callback; return { data: { subscription: { unsubscribe } } } })
    const cleanup = await observeGuestSession(changed)
    auth('SIGNED_OUT', null); expect(changed).not.toHaveBeenCalled()
    await Promise.resolve(); expect(changed).toHaveBeenCalledWith(null)
    cleanup(); expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
