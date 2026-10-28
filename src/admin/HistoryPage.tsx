import { useEffect, useState } from 'react'
import { editions } from '../config/editions'
import { AdminAccessError, adminRequest } from './client'
import type { ClosedPeriod, CountingHistory } from './client'
import { AdmissionHistory } from './AdmissionHistory'
import { exactAdmissionTime } from './time'

function PeriodCard({ period }: { period: ClosedPeriod }) {
  const snapshot = period.snapshot
  return <article className="period-card">
    <p className="eyebrow">COUNTING PERIOD {period.id.padStart(2, '0')}</p>
    <p className="period-closed">Closed: <time dateTime={period.closedAt}>{exactAdmissionTime(period.closedAt)}</time></p>
    <dl className={`period-counts${snapshot ? '' : ' unavailable'}`}><div><dt>Generated</dt><dd>{snapshot?.total ?? 'Unavailable'}</dd></div><div><dt>Admitted</dt><dd>{snapshot?.admitted ?? 'Unavailable'}</dd></div><div><dt>Waiting</dt><dd>{snapshot?.remaining ?? 'Unavailable'}</dd></div></dl>
    {!snapshot && <p className="admin-hint">Legacy reset: statistics were not captured at this time. Historical snapshot fields are unavailable.</p>}
    <details className="period-details"><summary>Period details &amp; edition distribution</summary>
      <dl className="period-metadata"><div><dt>Started</dt><dd>{snapshot ? period.periodStart ? exactAdmissionTime(period.periodStart) : 'All time before the first reset' : 'Unavailable (legacy reset)'}</dd></div><div><dt>Ended</dt><dd>{exactAdmissionTime(period.closedAt)}</dd></div><div><dt>Reset admin ID</dt><dd>{period.resetBy}</dd></div><div><dt>Exact server end</dt><dd>{period.closedAt}</dd></div>{snapshot && period.periodStart && <div><dt>Exact server start</dt><dd>{period.periodStart}</dd></div>}</dl>
      {snapshot ? <><p className="admin-hint">At closing · Lifetime generated: {snapshot.lifetimeGenerated} · Admitted: {snapshot.lifetimeAdmitted} · Outstanding valid: {snapshot.lifetimeRemaining}.</p>
        <div className="admin-table-wrap"><table><thead><tr><th>Edition</th><th>Generated</th><th>Admitted</th><th>Waiting</th></tr></thead><tbody>{editions.map(edition => { const row = snapshot.distribution.find(item => item.editionId === edition.id); return <tr key={edition.id}><th scope="row">{edition.name}</th><td>{row?.total ?? 0}</td><td>{row?.admitted ?? 0}</td><td>{row?.remaining ?? 0}</td></tr> })}</tbody></table></div></> : <p className="admin-hint">Period start, edition statistics and lifetime totals at closing: unavailable. The original reset timestamp and administrator are preserved.</p>}
    </details>
  </article>
}

export function HistoryPage({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [data, setData] = useState<CountingHistory | null>(null)
  const [beforeId, setBeforeId] = useState<string | null>(null), [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void adminRequest<CountingHistory>('periods', undefined, beforeId ? { beforeId } : undefined).then(result => {
      if (!cancelled) { setData(previous => beforeId && previous ? { ...result, periods: [...previous.periods, ...result.periods.filter(item => !previous.periods.some(old => old.id === item.id))] } : result); setError(null) }
    }).catch(error => {
      if (cancelled) return
      if (error instanceof AdminAccessError) onAccessDenied()
      else setError(error instanceof Error ? error.message : 'History unavailable.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [beforeId, revision, onAccessDenied])
  return <section className="admin-history-page"><p className="eyebrow">THE NIGHT, PRESERVED</p><h1>Every <em>chapter.</em></h1>
    <p className="admin-hint">Closed counting periods, newest first. Each recorded snapshot stays unchanged. Times use Europe/Athens; exact server timestamps appear in the details.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {data && <><h2>Operational totals · all time</h2><dl className="admin-counts history-lifetime"><div><dt>Generated</dt><dd>{data.lifetime.generated}</dd></div><div><dt>Admitted</dt><dd>{data.lifetime.admitted}</dd></div><div><dt>Outstanding · all valid</dt><dd>{data.lifetime.outstanding}</dd></div></dl>
      <h2>Counting periods</h2>{data.periods.length ? data.periods.map(period => <PeriodCard key={period.id} period={period} />) : <p className="admin-hint">No period has been closed yet. Your first confirmed reset will archive the current period.</p>}
      {data.nextBeforeId && <button className="admin-secondary" disabled={loading} onClick={() => { setLoading(true); setBeforeId(data.nextBeforeId) }}>LOAD EARLIER PERIODS</button>}
      <AdmissionHistory key={revision} onAccessDenied={onAccessDenied} /></>}
    <button className="admin-secondary" disabled={loading} onClick={() => { setLoading(true); setBeforeId(null); setRevision(value => value + 1) }}>{loading ? 'LOADING…' : 'REFRESH HISTORY'}</button>
  </section>
}
