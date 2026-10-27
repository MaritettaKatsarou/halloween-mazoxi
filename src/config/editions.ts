import type { TicketEdition } from '../types/ticket'
import collection from './ticket-collection.json'

// Only verified supplied artwork belongs here. No synthetic editions.
export const editions: TicketEdition[] = collection.editions
export const expectedOriginalCount = collection.expectedOriginalCount
