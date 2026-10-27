import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Atmosphere } from './components/Atmosphere'
import { Ticket } from './components/Ticket'
import { TicketQR } from './components/TicketQR'
import { editions, expectedOriginalCount } from './config/editions'
import { event } from './config/event'
import { useGuestTicket } from './hooks/useGuestTicket'

export function App() {
  const { ticket, loading, error, refresh, claim: issueTicket } = useGuestTicket()
  const [simulatedAdmission, setSimulatedAdmission] = useState(false)
  const [scanReady, setScanReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [info, setInfo] = useState(false)
  const [reviewEditionId, setReviewEditionId] = useState<string | null>(null)
  const edition = editions.find(e => e.id === (reviewEditionId || ticket?.editionId)) || editions[0]
  const admitted = ticket?.status === 'redeemed' || (import.meta.env.DEV && simulatedAdmission)
  const reviewing = import.meta.env.DEV && reviewEditionId !== null
  const credential = !reviewing && !admitted ? ticket?.qrCredential : null
  async function claim() {
    if (await issueTicket()) { setReveal(true); setReviewEditionId(null) }
  }
  function admit() {
    if (!import.meta.env.DEV) return
    setSimulatedAdmission(true); setScanReady(false)
  }
  return <div className="experience">
    <Atmosphere />
    <header className="masthead flex items-center justify-between"><a href="#" aria-label={event.name} className="wordmark">h<span>m</span><span className="wordmark-dot">.</span></a><span className="eyebrow">A PRIVATE GATHERING</span><button className="info-button" aria-expanded={info} aria-controls="event-note" onClick={() => setInfo(!info)}>Η πρόσκληση <span aria-hidden="true">{info ? '−' : '+'}</span></button></header>
    <main>
      <div className="intro"><p className="eyebrow intro-kicker"><span className="tiny-line" /> YOU’RE ON THE LIST <span className="tiny-line" /></p><h1>Halloween <em>μαζωξη</em><span className="title-dot">.</span></h1><p className="intro-copy">Μια νύχτα έξω απ’ τα συνηθισμένα.</p></div>
      <div className="collection-label"><span>THE INVITATION</span><span>EDITION {String(editions.indexOf(edition) + 1).padStart(2, '0')} / {String(editions.length).padStart(2, '0')}</span></div>
      <Ticket edition={edition} admitted={admitted} stable={scanReady} paused={paused} reveal={reveal}
        qrContent={credential ? <TicketQR credential={credential} /> : ticket || reviewing || admitted ? <span className="qr-inactive">{admitted ? 'ADMITTED' : 'ARTWORK PREVIEW'}</span> : undefined} />
      <div className="ticket-caption"><span className="status-dot" /><span>{admitted ? 'Η νύχτα μένει μαζί σου.' : scanReady ? 'Σταθερή προβολή · Κωδικός εισόδου' : 'Σύρε οριζόντια. Δες την άλλη πλευρά.'}</span></div>
      <section className="invitation-actions" aria-label="Η πρόσκλησή σου">
        <AnimatePresence mode="wait"><motion.div key={ticket ? 'claimed' : 'invitation'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {!ticket ? <button className="claim-button" disabled={loading} onClick={claim}>{loading ? 'ONE MOMENT…' : 'CLAIM YOUR TICKET'} <span aria-hidden="true">↗</span></button> : <div className="claimed-actions"><p className="eyebrow">{admitted ? 'ADMITTED' : `${ticket.displayNumber} · YOUR COLLECTIBLE`}</p><button className="claim-button" disabled={admitted || loading} onClick={() => { setScanReady(!scanReady); setReviewEditionId(null) }}>{admitted ? 'KEEP THE NIGHT' : scanReady ? 'BACK TO FLOATING' : 'PRESENT MY QR'}<span aria-hidden="true">{admitted ? '✓' : '↗'}</span></button></div>}
        </motion.div></AnimatePresence>
        <p className="preview-note" role="status">{import.meta.env.DEV && simulatedAdmission ? 'DEV SIMULATION · Το πραγματικό εισιτήριο δεν άλλαξε.' : reviewing ? 'ARTWORK PREVIEW · Η ανάθεση δεν άλλαξε.' : loading ? 'Σύνδεση με την πρόσκλησή σου…' : ticket ? 'Κράτησε αυτόν τον browser για να βρεις ξανά το εισιτήριό σου.' : 'Χωρίς εγγραφή. Μια πρόσκληση για τη νύχτα.'}</p>
        {error && <div className="ticket-error" role="alert"><p>{error}</p><button className="text-button" disabled={loading} onClick={() => void refresh()}>Δοκίμασε ξανά</button></div>}
        {scanReady && credential && <div className="scan-ready"><TicketQR credential={credential} /><p>{ticket?.displayNumber}</p><span>Δείξε τον κωδικό στην είσοδο.</span></div>}
        <button className="text-button" aria-pressed={paused} onClick={() => setPaused(!paused)} disabled={scanReady || admitted}>{paused ? 'Συνέχεια κίνησης' : 'Παύση περιστροφής'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button>
      </section>
      <AnimatePresence>{info && <motion.section id="event-note" className="event-note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><p className="eyebrow">HALLOWEEN ΜΑΖΩΞΗ</p><p>Μια ιδιωτική μάζωξη. Κράτησε την πρόσκλησή σου σαν μικρό ενθύμιο της νύχτας.</p><dl><div><dt>Ημερομηνία</dt><dd>{event.date || 'Προς επιβεβαίωση'}</dd></div><div><dt>Ώρα</dt><dd>{event.time || 'Προς επιβεβαίωση'}</dd></div><div><dt>Τοποθεσία</dt><dd>{event.location || 'Προς επιβεβαίωση'}</dd></div></dl><p className="note-small">Το artwork διατηρεί τα τυπωμένα στοιχεία του. Τα τελικά στοιχεία θα επιβεβαιωθούν πριν την έκδοση εισιτηρίων.</p></motion.section>}</AnimatePresence>
      {info && <p className="preview-note">Ένα εισιτήριο ανά ανώνυμο λογαριασμό. Άλλος browser, άλλη συσκευή ή διαγραφή της συνεδρίας επιτρέπουν νέο εισιτήριο. Δεν υπάρχει έλεγχος ανά φυσικό πρόσωπο.</p>}
      {import.meta.env.DEV && <aside className="dev-tools"><span>STUDIO / DEV ONLY · {editions.length}/{expectedOriginalCount} ORIGINALS</span><label className="artwork-review">Review artwork<select value={reviewEditionId || ticket?.editionId || editions[0].id} onChange={e => setReviewEditionId(e.target.value)}>{editions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{reviewEditionId && <button onClick={() => setReviewEditionId(null)}>Return to assigned artwork</button>}<button disabled={admitted} onClick={admit}>Simulate admission ↘</button>{simulatedAdmission && <button onClick={() => setSimulatedAdmission(false)}>Reset simulation</button>}</aside>}
    </main>
    <footer className="footer flex items-center justify-between"><span>COME AS YOU ARE.<br /><i>OR AS SOMEONE ELSE.</i></span><span>ΜΟΝΟ ΓΙΑ ΑΠΟΨΕ.<br />ΓΙΑ ΝΑ ΤΟ ΘΥΜΑΣΑΙ.</span></footer>
  </div>
}
