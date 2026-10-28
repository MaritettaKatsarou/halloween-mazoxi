import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Ticket } from '../src/components/Ticket'
import { mysteryTicket } from '../src/config/mystery'
import { editions } from '../src/config/editions'
import { parseGuestTicket } from '../src/lib/guestTickets'

describe('presentation-only Mystery Ticket', () => {
  it('keeps exactly 12 assignable editions and rejects Mystery as an issued edition', () => {
    expect(editions).toHaveLength(12)
    expect(editions.some(edition => edition.id === mysteryTicket.id)).toBe(false)
    expect(() => parseGuestTicket({ id: 'test', ownerId: 'test', editionId: mysteryTicket.id, displayNumber: 'TEST', status: 'issued',
      qrCredential: 'hm1_' + 'A'.repeat(43), createdAt: '2026-10-28T00:00:00Z', redeemedAt: null })).toThrow()
  })
  it('uses the supplied full-canvas artwork without QR, splitting or admission controls', () => {
    const html = renderToStaticMarkup(createElement(Ticket, { edition: mysteryTicket, admitted: false, stable: false, paused: false, reveal: false }))
    expect(html).toContain('mystery-ticket.png')
    expect(html.match(/<img\b/g)).toHaveLength(1)
    expect(html).toContain('width="1942" height="809"')
    expect(html).toContain('class="ticket-face ticket-back"')
    expect(html).toContain('<span class="back-quote-line">Claim your ticket</span> <span class="back-quote-line">to discover your</span> <span class="back-quote-line"><i>halloween quote</i></span>')
    expect(html).not.toContain('YOUR EDITION IS STILL A SECRET.')
    expect(html).not.toMatch(/ticket-qr|ticket-stub|<svg|admitted-stamp/)
  })
})
