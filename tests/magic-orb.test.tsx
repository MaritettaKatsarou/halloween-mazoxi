import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MagicOrbButton } from '../src/components/MagicOrbButton'

describe('accessible guest liquid capsule action', () => {
  it('has one native button with a readable label and decorative hidden layers', () => {
    const html = renderToStaticMarkup(createElement(MagicOrbButton, { children: 'PRESENT MY QR', onClick: () => {} }))
    expect(html.match(/<button\b/g)).toHaveLength(1)
    expect(html).toContain('type="button"')
    expect(html).toContain('class="orb-visual" aria-hidden="true"')
    expect(html).toContain('class="orb-settling"')
    expect(html).toContain('class="orb-shimmer"')
    expect(html).toContain('<span class="orb-label">PRESENT MY QR</span>')
  })
  it('preserves disabled/loading semantics and a quiet admitted state', () => {
    const html = renderToStaticMarkup(createElement(MagicOrbButton, { children: 'KEEP THE NIGHT', disabled: true, admitted: true, 'aria-busy': false }))
    expect(html).toContain('disabled=""')
    expect(html).toContain('orb-admitted')
    expect(html).toContain('aria-busy="false"')
  })
})
