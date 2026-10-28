import { useEffect, useRef, useState } from 'react'
import { editions } from '../config/editions'
import { AdminAccessError, adminRequest } from './client'
import type { AdminDashboard, ResetCountResult } from './client'
import { ResetCountDialog } from './ResetCountDialog'
import { AdmissionHistory, ArrivalList } from './AdmissionHistory'
import { admissionTime } from './time'

export function Dashboard({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resetRequest, setResetRequest] = useState<string | null>(null)
  const [resetBusy, setResetBusy] = useState(false), [resetError, setResetError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const resetting = useRef(false)
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
  function refresh() { setLoading(true); setRevision(value => value + 1) }
  async function resetCount() {
    if (!resetRequest || resetting.current) return
    resetting.current = true; setResetBusy(true); setResetError(null)
    try {
      await adminRequest<ResetCountResult>('reset-count', undefined, { requestId: resetRequest })
      setResetRequest(null); setNotice('Counting baseline saved. Tickets and admission history are preserved.'); refresh()
    } catch (error) {
      if (error instanceof AdminAccessError) onAccessDenied()
      else setResetError(error instanceof Error ? error.message : 'Reset could not be confirmed. Refresh counts before retrying.')
    } finally { resetting.current = false; setResetBusy(false) }
  }
  return <section className="admin-dashboard"><p className="eyebrow">THE GATHERING, IN NUMBERS</p><h1>A night <em>taking shape.</em></h1>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {data && <><dl className="admin-counts" aria-busy={loading}><div><dt>Tickets generated · all time</dt><dd>{data.total}</dd></div><div><dt>{data.baselineAt ? 'Tonight admitted' : 'Admitted · all time'}</dt><dd>{data.admitted}</dd></div><div><dt>Still to arrive · valid tickets</dt><dd>{data.remaining}</dd></div></dl>
      <p className="admin-hint dashboard-baseline">Lifetime admitted: {data.lifetimeAdmitted}. {data.baselineAt ? <>Tonight’s count starts {admissionTime(data.baselineAt)} (Europe/Athens).</> : 'No reset yet. Admissions include the complete history.'}</p>
      <h2>The collection</h2><div className="admin-table-wrap"><table><thead><tr><th>Edition</th><th>Issued · all time</th><th>{data.baselineAt ? 'Admitted · since reset' : 'Admitted · all time'}</th></tr></thead><tbody>{editions.map(edition => { const count = data.distribution.find(row => row.editionId === edition.id); return <tr key={edition.id}><th scope="row">{edition.name}</th><td>{count?.total ?? 0}</td><td>{count?.admitted ?? 0}</td></tr> })}</tbody></table></div>
      <h2>{data.baselineAt ? 'Tonight’s arrivals' : 'Recent arrivals · all time'}</h2><p className="admin-hint">Latest 20 admissions{data.baselineAt ? ' since the counting reset' : ' across the complete history'}.</p>{data.recent.length ? <ArrivalList items={data.recent} /> : <p className="admin-hint">The first arrival is still to come.</p>}
      <AdmissionHistory key={revision} onAccessDenied={onAccessDenied} /></>}
    {notice && <p className="admin-hint" role="status">{notice}</p>}
    <div className="dashboard-controls"><button className="admin-secondary" disabled={loading || resetBusy} onClick={refresh}>{loading ? 'LOADING…' : 'REFRESH COUNTS'}</button><button className="admin-secondary admin-reset-button" disabled={loading || resetBusy || !data} onClick={() => { setResetError(null); setNotice(''); setResetRequest(crypto.randomUUID()) }}>RESET COUNT</button></div>
    {resetRequest && <ResetCountDialog busy={resetBusy} error={resetError} onCancel={() => setResetRequest(null)} onConfirm={() => void resetCount()} />}
  </section>
}
