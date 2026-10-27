import type { CSSProperties } from 'react'
import type { TicketEdition } from '../types/ticket'
import { admissionGeometry } from './admissionGeometry'

export function artworkLayout(edition: TicketEdition) {
  const split = edition.perforation * 100
  const stubWidth = edition.width * (1 - edition.perforation)
  // The original image remains full size; only its viewing windows are split.
  const geometry = admissionGeometry(edition)
  const edge = [
    [0, 0], [0, 11], [-.3, 17], [.1, 24], [-.3, 32], [.1, 39],
    [-.4, 47], [0, 54], [-.3, 63], [.1, 70], [-.4, 79], [.1, 88], [-.3, 95], [0, 100],
  ]
  // Both fragments share an uncut band at the exact same lower-left hinge.
  const hingeY = edition.hingeY * 100
  const points = [...edge.filter(([, y]) => Math.abs(y - hingeY) > 2), [0, hingeY - 1], [0, hingeY], [0, hingeY + 1]]
    .filter(([, y]) => y >= 0 && y <= 100).sort((a, b) => a[1] - b[1])
  const mainPath = (torn: boolean) => `polygon(0 0, ${points.map(([offset, y]) => `${split + (torn ? offset : 0)}% ${y}%`).join(', ')}, 0 100%)`
  const stubPath = (torn: boolean) => `polygon(0 0, 100% 0, 100% 100%, ${[...points].reverse().map(([offset, y]) => `${torn ? Math.abs(offset) / (1 - edition.perforation) : 0}% ${y}%`).join(', ')})`
  return {
    mainPath, stubPath, geometry,
    ticket: {
      '--split': `${split}%`,
      '--stub-image-width': `${100 / (1 - edition.perforation)}%`,
      '--hinge-y': `${edition.hingeY * 100}%`,
      '--paper-color': edition.paperColor,
      '--souvenir-height-ratio': geometry.reservedHeightRatio,
      aspectRatio: `${edition.width}/${edition.height}`,
    } as CSSProperties,
    qr: {
      left: `${(edition.qr.x - edition.width * edition.perforation) / stubWidth * 100}%`,
      top: `${edition.qr.y / edition.height * 100}%`,
      width: `${edition.qr.width / stubWidth * 100}%`,
      height: `${edition.qr.height / edition.height * 100}%`,
    } as CSSProperties,
  }
}
