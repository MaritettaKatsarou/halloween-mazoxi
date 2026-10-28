// Keep this ordering stable: the persistent ticket UUID determines the index.
export const ticketBackQuotes = [
  { text: 'Witch better have my candy', lines: ['Witch better', 'have my candy'], compact: false },
  { text: 'No tricks, just treats', lines: ['No tricks,', 'just treats'], compact: false },
  { text: '100% that Witch', lines: ['100% that', 'Witch'], compact: false },
  { text: 'Witch please ...', lines: ['Witch', 'please ...'], compact: false },
  { text: 'Mali-BOO Barbie (or a Ken)', lines: ['Mali-BOO Barbie', '(or a Ken)'], compact: true },
] as const

/** FNV-1a over the existing ID; no new assignment, storage or randomness. */
export function quoteForTicket(ticketId: string) {
  let hash = 2166136261
  for (let index = 0; index < ticketId.length; index++) hash = Math.imul(hash ^ ticketId.charCodeAt(index), 16777619) >>> 0
  return ticketBackQuotes[hash % ticketBackQuotes.length]
}
