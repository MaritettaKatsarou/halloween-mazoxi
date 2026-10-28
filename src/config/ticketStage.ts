import { editions } from './editions'
import { admissionGeometry } from '../lib/admissionGeometry'

// Reserve the same space for restoration, mystery, reveal and the hanging stub.
export const ticketStageRatio = Math.max(...editions.map(edition => admissionGeometry(edition).reservedHeightRatio))
// Initial 40° diagonal canvas bounds; CSS adds room for the subtle float.
export const floatingStageRatio = Math.max(...editions.map(edition => Math.sin(40 * Math.PI / 180) + edition.height / edition.width * Math.cos(40 * Math.PI / 180)))
