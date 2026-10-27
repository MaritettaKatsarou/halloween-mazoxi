import { useCallback, useRef, useState } from 'react'
import { editions } from '../config/editions'
import { artworkUrl } from '../lib/artworkUrl'
import { CameraScanner } from './CameraScanner'
import { AdminAccessError, adminRequest } from './client'
import type { AdmissionResult } from './client'

export function Scanner({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [phase, setPhase] = useState<'scan' | 'validating' | 'result' | 'admitting'>('scan')
  const [result, setResult] = useState<AdmissionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [artworkReady, setArtworkReady] = useState(false)
  const [artworkError, setArtworkError] = useState(false)
  const [restartCamera, setRestartCamera] = useState(false)
  const credential = useRef<string | null>(null)
  const busy = useRef(false)
  const validate = useCallback(async (value: string) => {
    if (busy.current) return
    busy.current = true; credential.current = value
    setPhase('validating'); setManual(''); setError(null); setResult(null); setArtworkReady(false); setArtworkError(false)
    try { setResult(await adminRequest<AdmissionResult>('validate', value)) }
    catch (error) {
      if (error instanceof AdminAccessError) onAccessDenied()
      else setError(error instanceof Error ? error.message : 'Validation failed. Please retry.')
    } finally { busy.current = false; setPhase('result') }
  }, [onAccessDenied])
  const detected = useCallback((value: string) => { void validate(value) }, [validate])
  async function admit() {
    if (busy.current || result?.result !== 'VALID' || !credential.current || !artworkReady) return
    busy.current = true; setPhase('admitting'); setError(null)
    try { setResult(await adminRequest<AdmissionResult>('admit', credential.current)) }
    catch (error) {
      setResult(null) // A lost response might have committed. Require fresh validation.
      if (error instanceof AdminAccessError) onAccessDenied()
      else setError(error instanceof Error ? error.message : 'Admission response was lost. Check the code again.')
    } finally { busy.current = false; setPhase('result') }
  }
  function next() {
    credential.current = null; setResult(null); setError(null); setManual(''); setArtworkReady(false); setRestartCamera(true); setPhase('scan')
  }
  const ticket = result && result.result !== 'INVALID' ? result.ticket : null
  const edition = editions.find(e => e.id === ticket?.editionId)
  const status = result?.result
  return <section className="admin-scanner" aria-label="Ticket scanner">
    <p className="eyebrow">AT THE DOOR</p><h1>Let the <em>night in.</em></h1>
    {phase === 'scan' ? <><CameraScanner onDetected={detected} startImmediately={restartCamera} /><details className="manual-entry"><summary>Enter a QR credential manually</summary><form onSubmit={event => { event.preventDefault(); void validate(manual) }}><label>QR credential<input type="password" autoComplete="off" value={manual} maxLength={128} onChange={event => setManual(event.target.value)} required /></label><button className="admin-secondary" type="submit">VALIDATE</button></form></details></> : <div className="scan-result" aria-live="polite" aria-busy={phase === 'validating' || phase === 'admitting'}>
      {phase === 'validating' && <p className="eyebrow">VALIDATING TICKET…</p>}
      {status && <p className={`admission-status status-${status.toLowerCase()}`}>{status === 'VALID' ? '✓ VALID TICKET' : status === 'ADMITTED' ? '✓ ADMITTED' : status === 'ALREADY_USED' ? '× ALREADY USED' : '× INVALID QR'}</p>}
      {ticket && edition && <><img className="admin-ticket-art" src={artworkUrl(edition.file)} width={edition.width} height={edition.height} alt={edition.name} onLoad={event => setArtworkReady(event.currentTarget.naturalWidth > 0)} onError={() => { setArtworkReady(false); setArtworkError(true) }} /><p className="admin-ticket-number">{ticket.displayNumber}</p><p>{edition.name}</p>{ticket.redeemedAt && <p className="admin-hint">Admitted {new Date(ticket.redeemedAt).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}</p>}</>}
      {ticket && !edition && <p className="admin-error">Artwork edition is unavailable. Do not admit this ticket.</p>}
      {artworkError && <p className="admin-error" role="alert">Artwork could not load. Check the connection and validate again before admitting.</p>}
      {status === 'INVALID' && <p>This code does not match a ticket.</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {status === 'VALID' && <button className="admin-primary" disabled={!artworkReady || !edition || phase === 'admitting'} onClick={() => void admit()}>{phase === 'admitting' ? 'ADMITTING…' : !artworkReady ? 'LOADING ARTWORK…' : 'ADMIT'}</button>}
      {(error || artworkError) && <button className="admin-secondary" disabled={phase !== 'result'} onClick={() => { if (credential.current) void validate(credential.current) }}>CHECK STATUS AGAIN</button>}
      {phase === 'result' && <button className="admin-secondary" onClick={next}>SCAN NEXT ↗</button>}
    </div>}
  </section>
}
