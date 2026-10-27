import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, createServer, preview } from 'vite'
import type { PreviewServer, ViteDevServer } from 'vite'
import sharp from 'sharp'
import { Ticket } from '../src/components/Ticket'
import { TicketQR } from '../src/components/TicketQR'
import { editions } from '../src/config/editions'
import { parseGuestTicket } from '../src/lib/guestTickets'

const root = fileURLToPath(new URL('../', import.meta.url))
const base = '/halloween-mazoxi/'
let development: ViteDevServer | undefined
let production: PreviewServer | undefined
let origins: string[]
beforeAll(async () => {
  development = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } })
  await development.listen()
  // Build the actual application/config into an isolated ignored test directory.
  const outDir = 'node_modules/.cache/artwork-url-build'
  await build({ root, logLevel: 'silent', build: { outDir } })
  production = await preview({ root, logLevel: 'silent', build: { outDir }, preview: { host: '127.0.0.1', port: 0, strictPort: false } })
  origins = [development.httpServer, production.httpServer].map(server => {
    const address = server?.address()
    if (!address || typeof address === 'string') throw Error('Test HTTP server did not start')
    return `http://127.0.0.1:${address.port}`
  })
  vi.stubEnv('BASE_URL', base)
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await development?.close()
  if (production) await new Promise<void>((resolve, reject) => production!.httpServer.close(error => error ? reject(error) : resolve()))
})

describe('actual Ticket image URLs under the GitHub Pages base', () => {
  for (const original of editions) {
    it(`${original.id}: preview, claimed, restored and hanging souvenir resolve the original PNG`, async () => {
      // Exercise the same API-response parsing and edition lookup used after claim.
      // Synthetic data only: this test never issues or modifies a real ticket.
      const claimed = parseGuestTicket({ id: 'test-ticket', ownerId: 'test-owner',
        editionId: original.id, displayNumber: 'HM-TEST', status: 'issued',
        createdAt: '2026-10-27T00:00:00Z', redeemedAt: null, qrCredential: 'hm1_' + 'A'.repeat(43) })!
      const restored = parseGuestTicket(JSON.parse(JSON.stringify(claimed)))!
      const sources = new Set<string>()
      for (const state of ['preview', 'claimed', 'restored', 'admitted'] as const) {
        const ticket = state === 'restored' ? restored : claimed
        const edition = editions.find(e => e.id === ticket.editionId)!
        const html = renderToStaticMarkup(createElement(Ticket, {
          edition, admitted: state === 'admitted', stable: state !== 'preview',
          paused: false, reveal: state === 'claimed',
          qrContent: state === 'preview' ? undefined : createElement(TicketQR, { credential: ticket.qrCredential! }),
        }))
        const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1])
        expect(images).toHaveLength(2)
        expect(images[0]).toBe(images[1])
        expect(images[0]).toBe(base + encodeURI(original.file))
        expect(images[0]).not.toContain('public/')
        expect(images[0]).not.toContain('%2C')
        if (state !== 'preview') {
          // The QR stays nested in the same animated stub as the original image.
          expect(html).toMatch(/class="ticket-stub[^]*<img[^]*class="ticket-qr"/)
        }
        if (state === 'admitted') expect(html).toContain('admitted-stamp')
        sources.add(images[0])
      }
      expect(sources.size).toBe(1)
      const originalBytes = await readFile(new URL(`../public/${original.file}`, import.meta.url))
      for (const origin of origins) {
        const response = await fetch(origin + [...sources][0])
        expect(response.status).toBe(200)
        // A SPA fallback can return 200; MIME, bytes and decoding must also pass.
        expect(response.headers.get('Content-Type')).toContain('image/png')
        const bytes = Buffer.from(await response.arrayBuffer())
        expect(bytes.equals(originalBytes)).toBe(true)
        const { info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true })
        expect(info.width).toBe(original.width)
        expect(info.height).toBe(original.height)
        expect(info.width * info.height).toBeGreaterThan(0)
      }
    })
  }
})
