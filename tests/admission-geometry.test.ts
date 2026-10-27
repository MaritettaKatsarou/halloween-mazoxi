import { describe, expect, it } from 'vitest'
import { editions } from '../src/config/editions'
import { admissionGeometry, HANGING_ANGLE, rotateStubPoint } from '../src/lib/admissionGeometry'
import { artworkLayout } from '../src/lib/artworkLayout'
describe('physical lower-left paper hinge for every original edition', () => {
  for (const edition of editions) it(edition.id, () => {
    const geometry = admissionGeometry(edition), layout = artworkLayout(edition)
    for (const angle of [0, 34, 90, HANGING_ANGLE, 122]) {
      const pivot = rotateStubPoint(edition, geometry.hinge.x, geometry.hinge.y, angle)
      expect(pivot.x).toBeCloseTo(geometry.hinge.x)
      expect(pivot.y).toBeCloseTo(geometry.hinge.y)
    }
    const qrCenter = rotateStubPoint(edition, edition.qr.x + edition.qr.width / 2, edition.qr.y + edition.qr.height / 2, HANGING_ANGLE)
    expect(qrCenter.y).toBeGreaterThan(edition.height)
    expect(layout.mainPath(true)).toContain(`${edition.perforation * 100}% ${edition.hingeY * 100}%`)
    expect(layout.stubPath(true)).toContain(`0% ${edition.hingeY * 100}%`)
    expect(geometry.reservedHeightRatio).toBeGreaterThan(edition.height / edition.width)
    // Use the same canvas, pivot and translation as the nested DOM transforms.
    // Check the entire swing envelope at the smallest supported viewport.
    const offsetX = parseFloat(geometry.x) / 100 * edition.width
    const offsetY = parseFloat(geometry.y) / 100 * edition.height
    const ticketWidth = 320 * .72
    const scale = ticketWidth / edition.width
    const stageHeight = Math.max(295, ticketWidth * geometry.reservedHeightRatio)
    for (let angle = 0; angle <= 122; angle++) {
      for (const x of [geometry.hinge.x, edition.width]) for (const y of [0, edition.height]) {
        const p = rotateStubPoint(edition, x, y, angle)
        const screenX = 160 + (p.x - edition.width / 2 + offsetX) * scale
        const screenY = stageHeight / 2 + (p.y - edition.height / 2 + offsetY) * scale
        expect(screenX).toBeGreaterThan(0); expect(screenX).toBeLessThan(320)
        expect(screenY).toBeGreaterThan(0); expect(screenY).toBeLessThan(stageHeight)
      }
    }
  })
})
