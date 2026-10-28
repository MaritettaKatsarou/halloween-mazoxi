import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketBack } from '../src/components/TicketBack'
import { Ticket } from '../src/components/Ticket'
import { editions } from '../src/config/editions'
import { quoteForTicket, ticketBackQuotes } from '../src/config/ticketBack'

const texts = ['Witch better have my candy', 'No tricks, just treats', '100% that Witch', 'Witch please ...', 'Mali-BOO Barbie (or a Ken)']
const title = (html: string) => html.match(/<span class="back-title[^"]*">([\s\S]*?)<\/span><span class="back-footer"/)?.[1].replace(/<[^>]+>/g, '')

describe('persistent ticket reverse copy', () => {
  it('contains only the five exact requested quotes with lossless line breaks', () => {
    expect(ticketBackQuotes.map(quote => quote.text)).toEqual(texts)
    for (const quote of ticketBackQuotes) expect(quote.lines.join(' ')).toBe(quote.text)
  })
  it('uses a stable hash across reloads and can select every quote', async () => {
    expect(quoteForTicket('hello').text).toBe('Witch please ...') // Fixed FNV-1a compatibility vector.
    const before = quoteForTicket('persistent-test-ticket').text
    vi.resetModules()
    const reloaded = await import('../src/config/ticketBack')
    expect(reloaded.quoteForTicket('persistent-test-ticket').text).toBe(before)
    const assignments = Array.from({ length: 100 }, (_, i) => quoteForTicket(`fixture-${i}`).text)
    expect(new Set(assignments).size).toBe(5)
    expect(assignments.every(text => texts.includes(text))).toBe(true)
  })
  it('preserves the same quote for every edition and after admission', () => {
    const ticketId = 'persistent-ticket-fixture'
    for (const edition of editions) for (const admitted of [false, true]) {
      const html = renderToStaticMarkup(createElement(Ticket, { edition, ticketId, admitted, stable: true, paused: true, reveal: false }))
      expect(title(html)).toBe(quoteForTicket(ticketId).text)
    }
  })
  it('keeps unclaimed and Mystery titles neutral even if an ID is supplied', () => {
    for (const props of [{}, { ticketId: 'ignored', mystery: true }]) {
      const html = renderToStaticMarkup(createElement(TicketBack, props))
      expect(title(html)).toBe('Η νύχταμάς ανήκει.')
      expect(html).not.toContain('quote-title')
    }
  })
  it('uses the exact updated index and two-line footer', () => {
    const html = renderToStaticMarkup(createElement(TicketBack, { ticketId: 'fixture' }))
    expect(html).toContain('HALLOWEEN ΜΑΖΩΞΗ 2026 · PRIVATE INVITATION')
    expect(html).toContain('<span class="back-footer">COME AS YOU ARE.<br/>OR AS SOMEONE ELSE.</span>')
    expect(html).not.toContain('Ένα μικρό ενθύμιο.')
  })
})
