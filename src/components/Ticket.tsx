import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { TicketEdition } from '../types/ticket'
import { useTicketRotation } from '../hooks/useTicketRotation'
import { artworkLayout } from '../lib/artworkLayout'

// Issued tickets supply a real QR with its own quiet zone; simulation never creates a credential.
type Props = { edition: TicketEdition; admitted: boolean; stable: boolean; paused: boolean; reveal: boolean; qrContent?: ReactNode }
export function Ticket({ edition, admitted, stable, paused, reveal, qrContent }: Props) {
  const { rotateX, rotateY, rotateZ, handlers } = useTicketRotation(stable || admitted, paused)
  const reduced = useReducedMotion()
  // This is a URL path: keep commas literal so Vite's public middleware can
  // resolve the original filename; encode spaces and Unicode exactly once.
  const src = `${import.meta.env.BASE_URL}${encodeURI(edition.file)}`
  const layout = artworkLayout(edition)
  return <div className={`ticket-stage ${stable || admitted ? 'is-stable' : ''} ${admitted ? 'is-admitted' : ''}`}>
    <div className="ticket-glow" aria-hidden="true" />
    <motion.div className="ticket-float" animate={{ y: reduced || stable || admitted ? 0 : [0, -9, 0] }} transition={{ duration: 9.7, repeat: Infinity, ease: 'easeInOut' }}>
      <motion.div className="ticket-reveal" initial={false} animate={{ scale: reveal ? [0.9, 1.045, 1] : 1, opacity: 1, x: admitted ? '-6%' : '0%' }} transition={{ duration: reduced ? 0 : 1.3 }}>
        <motion.div className="ticket-tilt" style={{ rotateZ }}>
          <motion.div className="ticket-object" style={{ ...layout.ticket, rotateX, rotateY }} {...handlers} role="img" aria-label={`${edition.name}, ${admitted ? 'αναμνηστικό με κρεμαστό απόκομμα' : 'εισιτήριο προεπισκόπησης, σύρε οριζόντια για περιστροφή'}`}>
            <div className="ticket-face ticket-front">
              <div className={`ticket-main ${admitted ? 'is-torn' : ''}`}><img src={src} width={edition.width} height={edition.height} alt="" draggable={false} /></div>
              <motion.div className={`ticket-stub ${admitted ? 'is-torn' : ''}`} initial={false}
                animate={{ rotate: admitted ? (reduced ? 34 : [0, 0, 43, 28, 37, 32, 34]) : 0 }}
                transition={{ duration: reduced ? 0 : 2.8, times: [0, .19, .4, .58, .74, .9, 1], ease: 'easeInOut' }}>
                <img src={src} width={edition.width} height={edition.height} alt="" draggable={false} />
                {qrContent && <div className="ticket-qr" style={layout.qr}>{qrContent}</div>}
              </motion.div>
              {admitted && <><div className="paper-hinge" /><div className="tear-light" /><motion.span className="admitted-stamp" initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 1.4, duration: .6 }}>ADMITTED<span>Keep the night.</span></motion.span></>}
            </div>
            <div className="ticket-face ticket-back" aria-hidden="true"><span className="back-index">HALLOWEEN ΜΑΖΩΞΗ · PRIVATE INVITATION</span><span className="back-title">Η νύχτα<br /><i>μάς ανήκει.</i></span><span className="back-footer">Ένα μικρό ενθύμιο. Μια μεγάλη νύχτα.</span></div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  </div>
}
