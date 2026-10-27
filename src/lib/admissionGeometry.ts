import type { TicketEdition } from '../types/ticket'

export const HANGING_ANGLE = 116
export const HANGING_KEYFRAMES = [0, 0, 122, 110, 118, 114, HANGING_ANGLE]
export const ADMISSION_SETTLE_SECONDS = 1.25
export const TEAR_SECONDS = 2.8

export function rotateStubPoint(edition: TicketEdition, x: number, y: number, degrees: number) {
  const hinge = { x: edition.width * edition.perforation, y: edition.height * edition.hingeY }
  const angle = degrees * Math.PI / 180
  return {
    x: hinge.x + (x - hinge.x) * Math.cos(angle) - (y - hinge.y) * Math.sin(angle),
    y: hinge.y + (x - hinge.x) * Math.sin(angle) + (y - hinge.y) * Math.cos(angle),
  }
}
export function admissionGeometry(edition: TicketEdition) {
  const x = edition.width * edition.perforation
  const corners = [{ x, y: 0 }, { x: edition.width, y: 0 }, { x: edition.width, y: edition.height }, { x, y: edition.height }]
  const bounds = (angle: number) => {
    const points = corners.map(point => rotateStubPoint(edition, point.x, point.y, angle))
    return { left: Math.min(0, ...points.map(p => p.x)), right: Math.max(x, ...points.map(p => p.x)),
      top: Math.min(0, ...points.map(p => p.y)), bottom: Math.max(edition.height, ...points.map(p => p.y)) }
  }
  const final = bounds(HANGING_ANGLE)
  const yOffset = (final.bottom + final.top - edition.height) / 2
  const envelope = Array.from({ length: 123 }, (_, angle) => bounds(angle))
  const radius = Math.max(...envelope.flatMap(box => [Math.abs(box.top - edition.height / 2 - yOffset), Math.abs(box.bottom - edition.height / 2 - yOffset)]), edition.height / 2)
  return {
    x: `${-(final.left + final.right - edition.width) / (2 * edition.width) * 100}%`,
    y: `${-yOffset / edition.height * 100}%`,
    reservedHeightRatio: (2 * radius + 48) / edition.width,
    hinge: { x, y: edition.height * edition.hingeY },
  }
}
