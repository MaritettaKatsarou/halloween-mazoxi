import { describe, expect, it, vi } from 'vitest'
import { createGuestTicketController } from '../src/lib/guestTicketController'
import type { GuestTicket } from '../src/lib/guestTickets'
const issued: GuestTicket = { id: 'ticket-a', ownerId: 'owner-a', editionId: 'cauldron', displayNumber: 'HM-TEST', status: 'issued', createdAt: '2026-10-27T00:00:00Z', redeemedAt: null, qrCredential: 'hm1_' + 'A'.repeat(43) }
const redeemed: GuestTicket = { ...issued, status: 'redeemed', redeemedAt: '2026-10-27T00:01:00Z', qrCredential: null }
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture(initial: GuestTicket | null = issued) {
  let current = initial, notify = () => {}
  let auth: (id: string | null) => void = () => {}
  const cleanup = vi.fn()
  const load = vi.fn(async () => current)
  const controller = createGuestTicketController({ load, claim: async () => current,
    subscribe: async (_ticket, callback) => { notify = callback; return cleanup },
    observeSession: async callback => { auth = callback; return () => {} },
  })
  const stop = controller.start()
  return { controller, stop, load, cleanup, set: (ticket: GuestTicket | null) => { current = ticket }, notify: () => notify(), auth: (id: string | null) => auth(id) }
}
describe('authoritative guest admission state machine', () => {
  it('treats events only as hints and plays a genuine transition once', async () => {
    const f = fixture(); await tick()
    f.notify(); await tick(); expect(f.controller.snapshot().admissionPhase).toBe('ISSUED')
    f.set(redeemed); f.notify(); await tick(); expect(f.controller.snapshot().admissionPhase).toBe('ANIMATING')
    f.notify(); f.notify(); await tick(); expect(f.controller.snapshot().admissionPhase).toBe('ANIMATING')
    f.controller.finishAnimation(issued.id); expect(f.controller.snapshot().admissionPhase).toBe('REDEEMED')
    f.notify(); await tick(); expect(f.controller.snapshot().admissionPhase).toBe('REDEEMED'); f.stop()
  })
  it('refreshing an already redeemed ticket restores the final hanging state immediately', async () => {
    const f = fixture(redeemed); await tick()
    expect(f.controller.snapshot().admissionPhase).toBe('REDEEMED')
    expect(f.controller.snapshot().ticket?.qrCredential).toBeNull(); f.stop()
  })
  it('post-subscribe/reconnect refresh recovers an admission that occurred before subscription completed', async () => {
    const f = fixture(); await tick(); f.set(redeemed)
    f.notify(); await tick(); expect(f.controller.snapshot().admissionPhase).toBe('ANIMATING'); f.stop()
  })
  it('queues a notification arriving while another status request is in flight', async () => {
    const f = fixture(); await tick()
    let resolve!: (ticket: GuestTicket) => void
    f.load.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const refresh = f.controller.refresh(); f.set(redeemed); f.notify(); resolve(issued)
    await refresh; await tick()
    expect(f.controller.snapshot().admissionPhase).toBe('ANIMATING'); f.stop()
  })
  it('switching accounts removes the old channel and ignores stale in-flight results', async () => {
    const f = fixture(); await tick()
    let resolve!: (ticket: GuestTicket) => void
    f.load.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = f.controller.refresh()
    const next = { ...issued, id: 'ticket-b', ownerId: 'owner-b' }
    f.set(next); f.auth('owner-b'); resolve(redeemed); await pending; await tick()
    expect(f.cleanup).toHaveBeenCalled()
    expect(f.controller.snapshot().ticket?.id).toBe('ticket-b')
    expect(f.controller.snapshot().admissionPhase).toBe('ISSUED')
    f.controller.finishAnimation('ticket-a'); expect(f.controller.snapshot().admissionPhase).toBe('ISSUED'); f.stop()
  })
  it('never visually downgrades an authoritative redeemed state', async () => {
    const f = fixture(redeemed); await tick(); f.set(issued); await f.controller.refresh()
    expect(f.controller.snapshot().ticket?.status).toBe('redeemed'); f.stop()
  })
  it('recovers after an offline fetch fails without losing the issued ticket', async () => {
    const f = fixture(); await tick()
    f.load.mockRejectedValueOnce(new Error('offline')); await f.controller.refresh()
    expect(f.controller.snapshot().ticket).toEqual(issued)
    expect(f.controller.snapshot().error).toBe('offline')
    f.set(redeemed); await f.controller.refresh()
    expect(f.controller.snapshot().admissionPhase).toBe('ANIMATING')
    expect(f.controller.snapshot().error).toBeNull(); f.stop()
  })
  it('cleans delayed subscriptions after StrictMode start/stop and accepts only the current lifecycle', async () => {
    const callbacks: Array<(id: string | null) => void> = [], cleanups = [vi.fn(), vi.fn()]
    let resolveFirst!: (cleanup: () => void) => void
    const controller = createGuestTicketController({ load: async () => issued, claim: async () => issued,
      subscribe: async () => () => {}, observeSession: callback => {
        callbacks.push(callback)
        return callbacks.length === 1 ? new Promise(resolve => { resolveFirst = resolve }) : Promise.resolve(cleanups[1])
      },
    })
    controller.start()(); const stop = controller.start(); resolveFirst(cleanups[0]); await tick()
    expect(cleanups[0]).toHaveBeenCalledOnce()
    callbacks[0](null); await tick(); expect(controller.snapshot().ticket).toEqual(issued)
    stop(); expect(cleanups[1]).toHaveBeenCalledOnce()
  })
  it('retries a failed subscription setup on the next refresh', async () => {
    const subscribe = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(() => {})
    const controller = createGuestTicketController({ load: async () => issued, claim: async () => issued,
      subscribe, observeSession: async () => () => {},
    })
    const stop = controller.start(); await tick(); await controller.refresh(); await tick()
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(controller.snapshot().ticket).toEqual(issued); stop()
  })
})
