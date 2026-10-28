import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import type { TicketEdition } from '../types/ticket'
import { useTicketRotation } from '../hooks/useTicketRotation'
import { artworkLayout } from '../lib/artworkLayout'
import { artworkUrl } from '../lib/artworkUrl'
import type { AdmissionPhase } from '../lib/guestTicketController'
import { ADMISSION_SETTLE_SECONDS, HANGING_ANGLE, HANGING_KEYFRAMES, TEAR_SECONDS } from '../lib/admissionGeometry'
import type { MysteryArtwork } from '../config/mystery'
import { ticketStageRatio } from '../config/ticketStage'
import { TicketBack } from './TicketBack'

// Issued tickets supply a real QR with its own quiet zone; simulation never creates a credential.
type Props = { edition: TicketEdition | MysteryArtwork; ticketId?: string; admitted: boolean; stable: boolean; paused: boolean; reveal: boolean; qrContent?: ReactNode; admissionPhase?: AdmissionPhase; onAdmissionComplete?: () => void }
export function Ticket({ edition, ticketId, admitted, stable, paused, reveal, qrContent, admissionPhase, onAdmissionComplete }: Props) {
  const phase = admissionPhase ?? (admitted ? 'REDEEMED' : 'ISSUED')
  const final = phase === 'REDEEMED'
  const { rotateX, rotateY, rotateZ, handlers } = useTicketRotation(stable || admitted, paused, final)
  const reduced = useReducedMotion()
  // This is a URL path: keep commas literal so Vite's public middleware can
  // resolve the original filename; encode spaces and Unicode exactly once.
  const src = artworkUrl(edition.file)
  const mystery = 'kind' in edition
  const layout = mystery ? null : artworkLayout(edition)
  const animateTear = phase === 'ANIMATING' && !reduced
  const delay = animateTear ? ADMISSION_SETTLE_SECONDS : 0
  const duration = animateTear ? TEAR_SECONDS : 0
  const stageStyle = { '--souvenir-height-ratio': ticketStageRatio } as CSSProperties
  return <div className={`ticket-stage ${stable || admitted ? 'is-stable' : ''} ${admitted ? 'is-admitted' : ''}`} style={stageStyle} data-admission-phase={phase}>
    <div className="ticket-glow" aria-hidden="true" />
    <motion.div className="ticket-float" animate={{ y: reduced || stable || admitted ? 0 : [0, -9, 0] }} transition={admitted || reduced ? { duration: final || reduced ? 0 : .8 } : { duration: 9.7, repeat: Infinity, ease: 'easeInOut' }}>
      <motion.div className="ticket-reveal" initial={false} animate={{ scale: reveal && !admitted ? [0.9, 1.045, 1] : 1, opacity: 1, x: admitted && layout ? layout.geometry.x : '0%', y: admitted && layout ? layout.geometry.y : '0%' }} transition={{ duration: reduced || final ? 0 : ADMISSION_SETTLE_SECONDS }}>
        <motion.div className="ticket-tilt" style={{ rotateZ }}>
          <motion.div className="ticket-object" style={{ ...(layout?.ticket || { aspectRatio: `${edition.width}/${edition.height}` }), rotateX, rotateY }} {...handlers} role="img" aria-label={`${edition.name}, ${admitted ? 'αναμνηστικό με κρεμαστό απόκομμα' : 'εισιτήριο προεπισκόπησης, σύρε οριζόντια για περιστροφή'}`}>
            <div className="ticket-face ticket-front">
              {layout ? <><motion.div className="ticket-main" initial={false} animate={{ clipPath: layout.mainPath(admitted) }} transition={{ delay, duration: animateTear ? .7 : 0 }}><img src={src} width={edition.width} height={edition.height} alt="" draggable={false} /></motion.div>
              <motion.div className={`ticket-stub ${admitted ? 'is-torn' : ''}`} initial={false}
                animate={{ rotate: admitted ? (animateTear ? HANGING_KEYFRAMES : HANGING_ANGLE) : 0, clipPath: layout.stubPath(admitted) }}
                transition={{ rotate: { delay, duration, times: [0, .19, .4, .58, .74, .9, 1], ease: 'easeInOut' }, clipPath: { delay, duration: animateTear ? .7 : 0 } }}
                onAnimationComplete={() => { if (phase === 'ANIMATING') onAdmissionComplete?.() }}>
                <img src={src} width={edition.width} height={edition.height} alt="" draggable={false} />
                {qrContent && <div className="ticket-qr" style={layout.qr}>{qrContent}</div>}
              </motion.div>
              {admitted && <><div className="paper-hinge" />{animateTear && <div className="tear-light" style={{ animationDelay: `${delay - .15}s` }} />}<motion.span className="admitted-stamp" initial={animateTear ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: animateTear ? delay + 1.25 : 0, duration: animateTear ? .6 : 0 }}>ADMITTED<span>Keep the night.</span></motion.span></>}</> : <img className="ticket-mystery-art" src={src} width={edition.width} height={edition.height} alt="" draggable={false} />}
            </div>
            <TicketBack ticketId={ticketId} mystery={mystery} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  </div>
}
