import { Fragment } from 'react'
import { quoteForTicket } from '../config/ticketBack'

export function TicketBack({ ticketId, mystery = false }: { ticketId?: string; mystery?: boolean }) {
  const quote = !mystery && ticketId ? quoteForTicket(ticketId) : null
  return <div className="ticket-face ticket-back" aria-hidden="true">
    <span className="back-index">HALLOWEEN ΜΑΖΩΞΗ 2026 · PRIVATE INVITATION</span>
    <span className={`back-title${quote ? ` quote-title${quote.compact ? ' quote-title-compact' : ''}` : ''}`}>
      {quote ? quote.lines.map((line, index) => <Fragment key={line}>{index > 0 && ' '}<span className="back-quote-line">{index === quote.lines.length - 1 ? <i>{line}</i> : line}</span></Fragment>) : <>Η νύχτα<br /><i>μάς ανήκει.</i></>}
    </span>
    <span className="back-footer">COME AS YOU ARE.<br />OR AS SOMEONE ELSE.</span>
  </div>
}
