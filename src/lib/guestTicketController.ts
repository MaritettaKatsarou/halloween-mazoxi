import type { GuestTicket } from './guestTickets'
export type AdmissionPhase = 'ISSUED' | 'ANIMATING' | 'REDEEMED'
export type GuestView = { ticket: GuestTicket | null; admissionPhase: AdmissionPhase; loading: boolean; error: string | null }
type Cleanup = () => void
export type GuestControllerDependencies = {
  load: () => Promise<GuestTicket | null>
  claim: () => Promise<GuestTicket | null>
  subscribe: (ticket: GuestTicket, notify: () => void) => Promise<Cleanup>
  observeSession: (changed: (ownerId: string | null) => void) => Promise<Cleanup>
}

export function createGuestTicketController(dependencies: GuestControllerDependencies) {
  let state: GuestView = { ticket: null, admissionPhase: 'ISSUED', loading: true, error: null }
  const listeners = new Set<() => void>()
  let active = false, generation = 0, subscriptionVersion = 0, lifecycle = 0
  let knownOwner: string | null = null, channelKey: string | null = null
  let channelCleanup: Cleanup | undefined, authCleanup: Cleanup | undefined
  let running: Promise<void> | null = null, pending = false, claiming = false
  const emit = (change: Partial<GuestView>) => { state = { ...state, ...change }; listeners.forEach(listener => listener()) }
  const detach = () => { subscriptionVersion++; channelCleanup?.(); channelCleanup = undefined; channelKey = null }
  const attach = (ticket: GuestTicket) => {
    const key = `${ticket.ownerId}:${ticket.id}`
    if (channelKey === key) return
    detach(); channelKey = key
    const version = subscriptionVersion
    void dependencies.subscribe(ticket, () => {
      if (active && version === subscriptionVersion && state.ticket?.id === ticket.id) void refresh()
    }).then(cleanup => {
      if (!active || version !== subscriptionVersion) cleanup()
      else channelCleanup = cleanup
    }).catch(() => {
      // Retry setup on the next authoritative refresh after a transient Auth or
      // socket setup failure. Never let an old subscription clear a newer one.
      if (active && version === subscriptionVersion) channelKey = null
    })
  }
  const accept = (next: GuestTicket | null) => {
    if (next && knownOwner && next.ownerId !== knownOwner) return
    const previous = state.ticket
    const same = !!next && previous?.id === next.id && previous.ownerId === next.ownerId
    if (same && previous.status === 'redeemed' && next.status !== 'redeemed') return
    const admissionPhase: AdmissionPhase = next?.status === 'redeemed'
      ? same && previous.status === 'issued' ? 'ANIMATING' : same ? state.admissionPhase : 'REDEEMED'
      : 'ISSUED'
    emit({ ticket: next, admissionPhase, error: null })
    if (next) { knownOwner = next.ownerId; attach(next) } else detach()
  }
  function refresh(): Promise<void> {
    pending = true
    if (!active || claiming) return Promise.resolve()
    if (running) return running
    running = (async () => {
      while (pending && active && !claiming) {
        pending = false
        const version = generation
        emit({ loading: !state.ticket, error: null })
        try { const result = await dependencies.load(); if (active && generation === version) accept(result) }
        catch (error) { if (active && generation === version) emit({ error: error instanceof Error ? error.message : 'Η σύνδεση απέτυχε.' }) }
      }
    })().finally(() => { running = null; if (active) emit({ loading: false }); if (pending && active && !claiming) void refresh() })
    return running
  }
  async function claim() {
    if (!active || claiming || running) return false
    claiming = true; const version = generation
    emit({ loading: true, error: null })
    try {
      const result = await dependencies.claim()
      if (active && version === generation) { accept(result); return true }
      return false
    } catch (error) {
      if (active && version === generation) emit({ error: error instanceof Error ? error.message : 'Η έκδοση απέτυχε.' })
      return false
    } finally { claiming = false; if (active) { emit({ loading: false }); if (pending) void refresh() } }
  }
  function identityChanged(ownerId: string | null) {
    if (!active) return
    if ((knownOwner && knownOwner !== ownerId) || (state.ticket && state.ticket.ownerId !== ownerId)) {
      generation++; detach()
      emit({ ticket: null, admissionPhase: 'ISSUED', error: null, loading: true })
    }
    knownOwner = ownerId
    void refresh()
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      active = true; generation++; const version = ++lifecycle
      void dependencies.observeSession(owner => { if (active && lifecycle === version) identityChanged(owner) }).then(cleanup => {
        if (!active || lifecycle !== version) cleanup(); else authCleanup = cleanup
      }).catch(() => { /* refresh reports service configuration/network errors. */ })
      void refresh()
      return () => { active = false; lifecycle++; generation++; pending = false; detach(); authCleanup?.(); authCleanup = undefined }
    },
    refresh, claim,
    finishAnimation(ticketId: string) {
      if (active && state.ticket?.id === ticketId && state.admissionPhase === 'ANIMATING') emit({ admissionPhase: 'REDEEMED' })
    },
  }
}
