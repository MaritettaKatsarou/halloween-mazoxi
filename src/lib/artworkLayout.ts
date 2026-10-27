import type { CSSProperties } from 'react'
import type { TicketEdition } from '../types/ticket'

export function artworkLayout(edition: TicketEdition) {
  const split = edition.perforation * 100
  const stubWidth = edition.width * (1 - edition.perforation)
  // The original image remains full size; only its viewing windows are split.
  const jaggedEdge = [
    [0, 0], [0, 11], [-.3, 17], [.1, 24], [-.3, 32], [.1, 39],
    [-.4, 47], [0, 54], [-.3, 63], [.1, 70], [-.4, 79], [.1, 88], [-.3, 95], [0, 100],
  ].map(([offset, y]) => `${split + offset}% ${y}%`).join(', ')
  return {
    ticket: {
      '--split': `${split}%`,
      '--stub-image-width': `${100 / (1 - edition.perforation)}%`,
      '--hinge-y': `${edition.hingeY * 100}%`,
      '--paper-color': edition.paperColor,
      '--torn-main': `polygon(0 0, ${jaggedEdge}, 0 100%)`,
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
