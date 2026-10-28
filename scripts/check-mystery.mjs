import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import sharp from 'sharp'
const root = new URL('../', import.meta.url)
let bytes
try { bytes = await readFile(new URL('public/tickets/mystery-ticket.png', root)) }
catch { throw Error('Mystery artwork is not ready. Place the unchanged original in public/tickets/mystery-source.png and run npm run mystery:prepare. Do not deploy without the verified asset.') }
const source = await readFile(new URL('public/tickets/mystery-source.png', root))
assert.ok(bytes.equals(source), 'The supplied transparent original must be copied losslessly')
const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
assert.equal(info.width, 1942); assert.equal(info.height, 809)
const alpha = (x, y) => data[(y * info.width + x) * 4 + 3]
for (let x = 0; x < info.width; x++) { assert.ok(alpha(x, 0) <= 1); assert.ok(alpha(x, info.height - 1) <= 1) }
for (let y = 0; y < info.height; y++) { assert.ok(alpha(0, y) <= 1); assert.ok(alpha(info.width - 1, y) <= 1) }
console.log('Mystery Ticket: verified transparent original, 1942×809, byte-identical artwork; presentation only.')
