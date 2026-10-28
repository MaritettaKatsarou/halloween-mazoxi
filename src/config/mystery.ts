/** Presentation only. Never include this artwork in the assignable collection. */
export const mysteryTicket = {
  kind: 'mystery' as const,
  id: 'mystery',
  name: 'Mystery Ticket',
  file: 'tickets/mystery-ticket.png',
  width: 1942,
  height: 809,
}
export type MysteryArtwork = typeof mysteryTicket
