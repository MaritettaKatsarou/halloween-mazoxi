import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InvitationInfo } from '../src/components/InvitationInfo'
import { event } from '../src/config/event'

describe('final invitation information', () => {
  it('keeps the confirmed Athens event and exact display copy centrally configured', () => {
    expect(event.date).toBe('2026-10-31')
    expect(new Date(`${event.date}T12:00:00Z`).getUTCDay()).toBe(6)
    expect(event.time).toBe('19:00')
    expect(event.timeZone).toBe('Europe/Athens')
    expect(event.display).toEqual({ date: '31 Οκτ 2026', time: '07:00 μμ' })
    expect(event.location).toBe('Αμφιτρίτης 18, Παλαιο Φάληρο')
    expect(event.invitation.closing).toBe('Βάλε ό,τι σου αρέσει και κράτα το εισιτήριό σου για την είσοδο. Τα λέμε εκεί.')
  })
  it('renders the exact short invitation, semantic detail rows and accessible copy control', () => {
    const html = renderToStaticMarkup(createElement(InvitationInfo, { open: true }))
    expect(html).toContain('HALLOWEEN ΜΑΖΩΞΗ 2026')
    expect(html).toContain('Let&#x27;s dress up and have fun !')
    expect(html).toContain(event.invitation.closing)
    expect(html).toContain(`<span class="event-address">${event.location}</span>`)
    expect(html.match(/<dt>/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Αντιγραφή διεύθυνσης"')
    expect(html).toContain('aria-describedby="address-copy-feedback"')
    expect(html).toContain('data-copy-state="idle"')
    expect(html).not.toContain('Προς επιβεβαίωση')
    expect(html).not.toContain('ανώνυμο λογαριασμό')
    expect(html).not.toContain('Η διεύθυνση αντιγράφηκε.')
  })
  it('keeps the panel absent when collapsed', () => {
    expect(renderToStaticMarkup(createElement(InvitationInfo, { open: false }))).toBe('')
  })
})
