import { useCallback, useEffect, useRef, useState } from 'react'
import { claimGuestTicket, loadGuestTicket } from '../lib/guestTickets'
import type { GuestTicket } from '../lib/guestTickets'

export function useGuestTicket() {
  const [ticket, setTicket] = useState<GuestTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true; setLoading(true); setError(null)
    try { const result = await loadGuestTicket(); if (mounted.current) setTicket(result) }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Η σύνδεση απέτυχε.') }
    finally { busy.current = false; if (mounted.current) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true
    void Promise.resolve().then(() => { if (mounted.current) return refresh() })
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => { mounted.current = false; window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])
  const claim = async () => {
    if (busy.current) return false
    busy.current = true; setLoading(true); setError(null)
    try {
      const result = await claimGuestTicket()
      if (mounted.current) setTicket(result)
      return true
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Η έκδοση απέτυχε.'); return false }
    finally { busy.current = false; if (mounted.current) setLoading(false) }
  }
  return { ticket, loading, error, refresh, claim }
}
