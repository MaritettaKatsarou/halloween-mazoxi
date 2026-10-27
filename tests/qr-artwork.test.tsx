import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import jsQR from 'jsqr'
import { TicketQR } from '../src/components/TicketQR'
import { artworkLayout } from '../src/lib/artworkLayout'
import { editions } from '../src/config/editions'

// Synthetic test payload: not a hosted ticket or a usable admission credential.
const payload = 'hm1_' + 'A'.repeat(43)
describe('QR rendering and original artwork placement', () => {
  it('round-trips the SVG at scan-ready size with a four-module white quiet zone', async () => {
    const svg = renderToStaticMarkup(createElement(TicketQR, { credential: payload }))
    expect(svg).toContain('#ffffff')
    expect(svg).toContain('#000000')
    const { data, info } = await sharp(Buffer.from(svg)).resize(228, 228).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(payload)
    expect(Array.from(data.subarray(0, 4))).toEqual([255, 255, 255, 255])
  })
  it('covers the full placeholder and decodes inside each of the 12 configured rectangles', async () => {
    const svg = Buffer.from(renderToStaticMarkup(createElement(TicketQR, { credential: payload })))
    const tiles = []
    for (const [index, edition] of editions.entries()) {
      const { qr, width, height } = edition
      const layout = artworkLayout(edition)
      const recoveredX = width * edition.perforation + parseFloat(String(layout.qr.left)) / 100 * width * (1 - edition.perforation)
      expect(recoveredX).toBeCloseTo(qr.x, 6)
      expect(parseFloat(String(layout.qr.top)) / 100 * height).toBeCloseTo(qr.y, 6)
      const original = await readFile(new URL(`../public/${edition.file}`, import.meta.url))
      // Contain retains square QR modules; the entire rectangle gets opaque white.
      const overlay = await sharp(svg).resize(qr.width, qr.height, { fit: 'contain', background: '#fff' }).png().toBuffer()
      const { data, info } = await sharp(overlay).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, edition.id).toBe(payload)
      for (let pixel = 3; pixel < data.length; pixel += 4) expect(data[pixel], edition.id).toBe(255)
      const composite = await sharp(original).composite([{ input: overlay, left: qr.x, top: qr.y }]).png().toBuffer()
      const thumb = await sharp(composite).resize(600, 280, { fit: 'contain', background: '#241e25' }).png().toBuffer()
      tiles.push({ input: thumb, left: index % 2 * 600, top: Math.floor(index / 2) * 280 })
    }
    await mkdir('.artifacts', { recursive: true })
    await writeFile('.artifacts/qr-artwork-review.png', await sharp({ create: { width: 1200, height: 1680, channels: 4, background: '#241e25' } }).composite(tiles).png().toBuffer())
  })
})
