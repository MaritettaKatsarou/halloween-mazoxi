import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Atmosphere } from './components/Atmosphere'
import { Ticket } from './components/Ticket'
import { TicketQR } from './components/TicketQR'
import { editions, expectedOriginalCount } from './config/editions'
import { event } from './config/event'
import { useGuestTicket } from './hooks/useGuestTicket'
import { useArtwork } from './hooks/useArtwork'
import { artworkUrl } from './lib/artworkUrl'
import { mysteryTicket } from './config/mystery'
import { floatingStageRatio, ticketStageRatio } from './config/ticketStage'
import { MagicOrbButton } from './components/MagicOrbButton'
import { InvitationInfo } from './components/InvitationInfo'

export function App() {
  const { ticket, resolution, loading, error, refresh, claim: issueTicket, admissionPhase, finishAnimation } = useGuestTicket()
  const reduced = useReducedMotion()
  const [simulation, setSimulation] = useState<{ key: string; phase: 'ANIMATING' | 'REDEEMED' } | null>(null)
  const [scanReady, setScanReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [info, setInfo] = useState(false)
  const infoButton = useRef<HTMLButtonElement>(null)
  const [reviewEditionId, setReviewEditionId] = useState<string | null>(null)
  const reviewing = import.meta.env.DEV && reviewEditionId !== null && (resolution === 'owned' || resolution === 'unclaimed')
  const reviewEdition = reviewing ? editions.find(e => e.id === reviewEditionId) : undefined
  const reviewArtwork = useArtwork(reviewEdition ? artworkUrl(reviewEdition.file) : null)
  const mysteryArtwork = useArtwork(resolution === 'unclaimed' && !reviewing ? artworkUrl(mysteryTicket.file) : null)
  const edition = reviewing ? reviewArtwork.ready ? reviewEdition : undefined
    : resolution === 'owned' ? editions.find(e => e.id === ticket?.editionId)
    : resolution === 'unclaimed' && mysteryArtwork.ready ? mysteryTicket : undefined
  const previewKey = `${ticket?.ownerId || 'preview'}:${ticket?.id || 'preview'}:${edition?.id || 'unresolved'}`
  const simulatedAdmission = import.meta.env.DEV && simulation?.key === previewKey
  const admitted = ticket?.status === 'redeemed' || (import.meta.env.DEV && simulatedAdmission)
  const credential = !reviewing && !admitted && resolution === 'owned' ? ticket?.qrCredential : null
  const artworkError = reviewing ? reviewArtwork.error : mysteryArtwork.error
  const displayError = error || artworkError
  const stageStyle = { '--souvenir-height-ratio': ticketStageRatio, '--floating-height-ratio': floatingStageRatio } as CSSProperties
  async function claim() {
    if (await issueTicket()) { setReveal(true); setReviewEditionId(null) }
  }
  function admit() {
    if (!import.meta.env.DEV) return
    setSimulation({ key: previewKey, phase: 'ANIMATING' }); setScanReady(false)
  }
  return <div className="experience" onKeyDown={event => { if (event.key === 'Escape' && info) { setInfo(false); infoButton.current?.focus() } }}>
    <Atmosphere />
    <header className="masthead flex items-center justify-between"><a href="#" aria-label={event.name} className="wordmark">h<span>m</span><span className="wordmark-dot">.</span></a><span className="eyebrow">A PRIVATE GATHERING</span></header>
    <main>
      <div className="intro"><p className="eyebrow intro-kicker"><span className="tiny-line" /> YOU’RE ON THE LIST <span className="tiny-line" /></p><h1>Halloween <em>μαζωξη</em><span className="title-dot">.</span></h1></div>
      <div className="invitation-heading"><div className="collection-label"><span>THE INVITATION</span><button ref={infoButton} id="invitation-info-toggle" className="info-button" aria-expanded={info} aria-controls="event-note" onClick={() => setInfo(!info)}>Η πρόσκληση <span aria-hidden="true">{info ? '−' : '+'}</span></button></div><InvitationInfo open={info} /></div>
      <div className={`ticket-presentation${admitted ? ' is-admitted' : ''}`} style={stageStyle} aria-busy={loading}>
        <AnimatePresence mode="wait" initial={false}><motion.div key={edition ? previewKey : 'neutral'} className="ticket-presentation-layer"
          initial={{ opacity: 0, scale: reduced ? 1 : .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : 1.01 }} transition={{ duration: reduced ? .12 : .45, ease: 'easeInOut' }}>
      {edition ? <Ticket edition={edition} ticketId={ticket?.id} admitted={admitted} stable={scanReady} paused={paused} reveal={reveal}
        admissionPhase={ticket?.status === 'redeemed' ? admissionPhase : simulatedAdmission && simulation ? simulation.phase : 'ISSUED'}
        onAdmissionComplete={() => { if (ticket?.status === 'redeemed') finishAnimation(ticket.id); else if (simulatedAdmission) setSimulation({ key: previewKey, phase: 'REDEEMED' }) }}
        qrContent={credential ? <TicketQR credential={credential} /> : ticket || reviewing || admitted ? <span className="qr-inactive">{admitted ? 'ADMITTED' : 'ARTWORK PREVIEW'}</span> : undefined} /> : <div className="ticket-stage ticket-neutral" style={stageStyle}><div className="ticket-glow" aria-hidden="true" /><p className="ticket-loading-note" role="status">{displayError ? 'YOUR INVITATION IS UNAVAILABLE' : resolution === 'restoring' ? 'RESTORING YOUR INVITATION' : 'PREPARING YOUR INVITATION'}<span aria-hidden="true" /></p></div>}
        </motion.div></AnimatePresence>
      </div>
      <div className="ticket-tools"><div className="ticket-caption"><span className="status-dot" /><span>{admitted ? 'Η νύχτα μένει μαζί σου.' : scanReady ? 'Σταθερή προβολή · Κωδικός εισόδου' : 'Σύρε οριζόντια. Δες την άλλη πλευρά.'}</span></div><button className="text-button rotation-button" aria-label={paused ? 'Συνέχεια κίνησης' : 'Παύση περιστροφής'} title={paused ? 'Συνέχεια κίνησης' : 'Παύση περιστροφής'} aria-pressed={paused} onClick={() => setPaused(!paused)} disabled={scanReady || admitted}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button></div>
      <section className="invitation-actions" aria-label="Η πρόσκλησή σου">
        <AnimatePresence mode="wait"><motion.div key={ticket ? 'claimed' : 'invitation'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {!ticket ? <MagicOrbButton aria-busy={loading} disabled={loading || resolution !== 'unclaimed' || !mysteryArtwork.ready} onClick={claim}>{resolution === 'restoring' ? 'RESTORING YOUR TICKET…' : resolution === 'error' || artworkError ? 'INVITATION UNAVAILABLE' : loading ? 'ONE MOMENT…' : !mysteryArtwork.ready ? 'PREPARING YOUR INVITATION…' : 'CLAIM YOUR TICKET'}</MagicOrbButton> : <div className="claimed-actions"><p className="eyebrow">{admitted ? 'ADMITTED' : `${ticket.displayNumber} · YOUR COLLECTIBLE`}</p><MagicOrbButton admitted={admitted} aria-busy={loading} disabled={admitted || loading} onClick={() => { setScanReady(!scanReady); setReviewEditionId(null) }}>{admitted ? 'KEEP THE NIGHT' : scanReady ? 'BACK TO FLOATING' : 'PRESENT MY QR'}</MagicOrbButton></div>}
        </motion.div></AnimatePresence>
        <p className={`preview-note${!loading && !simulatedAdmission && !reviewing ? ' is-quiet' : ''}`} role="status">{import.meta.env.DEV && simulatedAdmission ? 'DEV SIMULATION · Το πραγματικό εισιτήριο δεν άλλαξε.' : reviewing ? 'ARTWORK PREVIEW · Η ανάθεση δεν άλλαξε.' : loading ? 'Σύνδεση με την πρόσκλησή σου…' : ticket ? 'Κράτησε αυτόν τον browser για να βρεις ξανά το εισιτήριό σου.' : 'Χωρίς εγγραφή. Μια πρόσκληση για τη νύχτα.'}</p>
        {displayError && <div className="ticket-error" role="alert"><p>{displayError}</p><button className="text-button" disabled={loading} onClick={() => { if (error) void refresh(); else if (reviewing) reviewArtwork.retry(); else mysteryArtwork.retry() }}>Δοκίμασε ξανά</button></div>}
        {scanReady && (credential || admitted) && <div className="scan-ready">{credential ? <TicketQR credential={credential} /> : <div className="scan-ready-souvenir">ADMITTED<span>Keep the night.</span></div>}<p>{ticket?.displayNumber}</p><span>{admitted ? 'Η νύχτα μένει μαζί σου.' : 'Δείξε τον κωδικό στην είσοδο.'}</span></div>}
      </section>
      {import.meta.env.DEV && <aside className="dev-tools"><span>STUDIO / DEV ONLY · {editions.length}/{expectedOriginalCount} ORIGINALS</span><label className="artwork-review">Review artwork<select value={reviewEditionId || ticket?.editionId || ''} onChange={e => setReviewEditionId(e.target.value || null)}><option value="">Unclaimed invitation</option>{editions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{reviewEditionId && <button onClick={() => setReviewEditionId(null)}>Return to assigned artwork</button>}<button disabled={admitted || !edition || 'kind' in edition} onClick={admit}>Simulate admission ↘</button>{simulatedAdmission && <button onClick={() => setSimulation(null)}>Reset simulation</button>}</aside>}
    </main>
    <footer className="footer flex items-center justify-between"><span>COME AS YOU ARE.<br /><i>OR AS SOMEONE ELSE.</i></span><span>ΜΟΝΟ ΓΙΑ ΑΠΟΨΕ.<br />ΓΙΑ ΝΑ ΤΟ ΘΥΜΑΣΑΙ.</span></footer>
  </div>
}
