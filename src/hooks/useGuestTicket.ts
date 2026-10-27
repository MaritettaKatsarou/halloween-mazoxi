import { useEffect, useState, useSyncExternalStore } from 'react'
import { claimGuestTicket, loadGuestTicket } from '../lib/guestTickets'
import { createGuestTicketController } from '../lib/guestTicketController'
import { observeGuestSession, subscribeToAdmission } from '../lib/admissionRealtime'

export function useGuestTicket() {
  const [controller] = useState(() => createGuestTicketController({
    load: loadGuestTicket, claim: claimGuestTicket, subscribe: subscribeToAdmission, observeSession: observeGuestSession,
  }))
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => {
    const stop = controller.start()
    const onVisible = () => { if (document.visibilityState === 'visible') void controller.refresh() }
    // A quiet recovery check covers networks that silently stop delivering sockets.
    const interval = window.setInterval(onVisible, 30000)
    window.addEventListener('online', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => { stop(); clearInterval(interval); window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible) }
  }, [controller])
  return { ...state, refresh: controller.refresh, claim: controller.claim, finishAnimation: controller.finishAnimation }
}
