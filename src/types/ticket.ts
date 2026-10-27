export type TicketEdition = {
  id: string
  name: string
  file: string
  width: number
  height: number
  perforation: number
  /** Full-canvas pixel bounds, including the white quiet-zone area. */
  qr: { x: number; y: number; width: number; height: number }
  /** Lower-left attachment measured from the top of the stub (0–1). */
  hingeY: number
  paperColor: string
}
