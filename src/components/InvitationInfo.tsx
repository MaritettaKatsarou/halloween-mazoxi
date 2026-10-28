import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { event } from '../config/event'

export function InvitationInfo({ open }: { open: boolean }) {
  const reduced = useReducedMotion()
  return <AnimatePresence initial={false}>{open && <motion.section id="event-note" className="event-note"
    aria-labelledby="invitation-info-toggle" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .24 }}>
    <div className="event-note-content"><p className="eyebrow">HALLOWEEN ΜΑΖΩΞΗ</p>
      <p>Μια ιδιωτική μάζωξη. Κράτησε την πρόσκλησή σου σαν μικρό ενθύμιο της νύχτας.</p>
      <p className="note-small">Χωρίς εγγραφή. Κράτησε αυτόν τον browser για να βρεις ξανά το εισιτήριό σου.</p>
      <dl><div><dt>Ημερομηνία</dt><dd>{event.date || 'Προς επιβεβαίωση'}</dd></div><div><dt>Ώρα</dt><dd>{event.time || 'Προς επιβεβαίωση'}</dd></div><div><dt>Τοποθεσία</dt><dd>{event.location || 'Προς επιβεβαίωση'}</dd></div></dl>
      <p className="note-small">Το artwork διατηρεί τα τυπωμένα στοιχεία του. Τα τελικά στοιχεία θα επιβεβαιωθούν πριν την έκδοση εισιτηρίων.</p>
      <p className="note-small">Ένα εισιτήριο ανά ανώνυμο λογαριασμό. Άλλος browser, άλλη συσκευή ή διαγραφή της συνεδρίας επιτρέπουν νέο εισιτήριο. Δεν υπάρχει έλεγχος ανά φυσικό πρόσωπο.</p>
    </div>
  </motion.section>}</AnimatePresence>
}
