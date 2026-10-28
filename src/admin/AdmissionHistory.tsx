import { useRef, useState } from 'react'
import { AdminAccessError, adminRequest } from './client'
import type { AdminDashboard, AdminHistory } from './client'
import { editions } from '../config/editions'
import { admissionTime } from './time'

export function ArrivalList({ items }: { items: AdminDashboard['recent'] }) {
  return <ol className="admission-activity">{items.map(item => <li key={item.id}><span>{item.displayNumber}<small>{editions.find(e => e.id === item.editionId)?.name || item.editionId}</small></span><time dateTime={item.redeemedAt || undefined}>{item.redeemedAt && admissionTime(item.redeemedAt)}</time></li>)}</ol>
}

export function AdmissionHistory({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [data, setData] = useState<AdminHistory | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  async function load(more = false) {
    if (pending.current) return
    pending.current = true; setLoading(true); setError(null)
    try {
      const result = await adminRequest<AdminHistory>('history', undefined, more && data?.nextCursor ? { cursor: data.nextCursor } : undefined)
      setData(previous => more && previous ? { ...result, items: [...previous.items, ...result.items.filter(item => !previous.items.some(old => old.id === item.id))] } : result)
    } catch (error) {
      if (error instanceof AdminAccessError) onAccessDenied()
      else setError(error instanceof Error ? error.message : 'History unavailable.')
    } finally { pending.current = false; setLoading(false) }
  }
  return <details className="dashboard-history" onToggle={event => { if (event.currentTarget.open && !data) void load() }}>
    <summary>Detailed admission history · all time</summary>
    <p className="admin-hint">Every admission is preserved. Load earlier arrivals to browse the complete history. Times use Europe/Athens.</p>
    {data && <><ArrivalList items={data.items} />{!data.items.length && <p className="admin-hint">No admissions recorded.</p>}
      {data.nextCursor && <button className="admin-secondary" disabled={loading} onClick={() => void load(true)}>LOAD EARLIER ARRIVALS</button>}
      </>}
    {loading && <p className="admin-hint" role="status">Loading history…</p>}{error && <p className="admin-error" role="alert">{error} <button className="admin-secondary" disabled={loading} onClick={() => void load(!!data?.nextCursor)}>RETRY HISTORY</button></p>}
  </details>
}
