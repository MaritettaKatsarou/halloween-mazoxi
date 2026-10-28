import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { event } from '../config/event'

export function InvitationInfo({ open }: { open: boolean }) {
  const reduced = useReducedMotion()
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  useEffect(() => {
    if (copyState !== 'copied') return
    const timer = window.setTimeout(() => setCopyState('idle'), 3000)
    return () => window.clearTimeout(timer)
  }, [copyState])
  async function copyAddress() {
    setCopyState('copying')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(event.location)
      setCopyState('copied')
    } catch { setCopyState('error') }
  }
  return <AnimatePresence initial={false}>{open && <motion.section id="event-note" className="event-note"
    aria-labelledby="invitation-info-toggle" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .24 }}>
    <div className="event-note-content">
      <p className="eyebrow">{event.name.toLocaleUpperCase('el-GR')} {event.date.slice(0, 4)}</p>
      <h2>{event.invitation.headline}</h2>
      <dl>
        <div><dt>Ημερομηνία</dt><dd><time dateTime={event.date}>{event.display.date}</time></dd></div>
        <div><dt>Ώρα</dt><dd><time dateTime={event.time}>{event.display.time}</time></dd></div>
        <div className="event-location"><dt>Τοποθεσία</dt><dd><span className="event-address">{event.location}</span><button type="button" className="address-copy" aria-label="Αντιγραφή διεύθυνσης" aria-describedby="address-copy-feedback" disabled={copyState === 'copying'} data-copy-state={copyState} onClick={() => void copyAddress()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">{copyState === 'copied' ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}</svg>
        </button></dd></div>
      </dl>
      <p id="address-copy-feedback" className={`address-copy-feedback${copyState === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">{copyState === 'copied' ? 'Η διεύθυνση αντιγράφηκε.' : copyState === 'error' ? 'Δεν έγινε αντιγραφή. Επίλεξε τη διεύθυνση και αντέγραψέ τη χειροκίνητα.' : ''}</p>
      <p className="invitation-closing">{event.invitation.closing}</p>
    </div>
  </motion.section>}</AnimatePresence>
}
