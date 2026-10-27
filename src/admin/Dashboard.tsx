import { useEffect, useState } from 'react'
import { editions } from '../config/editions'
import { AdminAccessError, adminRequest } from './client'
import type { AdminDashboard } from './client'

export function Dashboard({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    void adminRequest<AdminDashboard>('dashboard').then(value => {
      if (!cancelled) { setData(value); setError(null) }
    }).catch(error => {
      if (!cancelled) {
        if (error instanceof AdminAccessError) onAccessDenied()
        else setError(error instanceof Error ? error.message : 'Dashboard unavailable.')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [revision, onAccessDenied])
  return <section className="admin-dashboard"><p className="eyebrow">THE GATHERING, IN NUMBERS</p><h1>A night <em>taking shape.</em></h1>
    <button className="admin-secondary" disabled={loading} onClick={() => { setLoading(true); setRevision(revision + 1) }}>{loading ? 'LOADING…' : 'REFRESH COUNTS'}</button>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {data && <><dl className="admin-counts"><div><dt>Tickets generated</dt><dd>{data.total}</dd></div><div><dt>Admitted</dt><dd>{data.admitted}</dd></div><div><dt>Still to arrive</dt><dd>{data.remaining}</dd></div></dl>
      <h2>The collection</h2><div className="admin-table-wrap"><table><thead><tr><th>Edition</th><th>Tickets</th><th>Admitted</th></tr></thead><tbody>{editions.map(edition => { const count = data.distribution.find(row => row.editionId === edition.id); return <tr key={edition.id}><th scope="row">{edition.name}</th><td>{count?.total ?? 0}</td><td>{count?.admitted ?? 0}</td></tr> })}</tbody></table></div>
      <h2>Through the door</h2>{data.recent.length ? <ol className="admission-activity">{data.recent.map(item => <li key={item.id}><span>{item.displayNumber}<small>{editions.find(e => e.id === item.editionId)?.name || item.editionId}</small></span><time dateTime={item.redeemedAt || undefined}>{item.redeemedAt && new Date(item.redeemedAt).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}</time></li>)}</ol> : <p className="admin-hint">The first arrival is still to come.</p>}</>}
  </section>
}
