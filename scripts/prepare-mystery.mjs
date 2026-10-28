// The supplied original already has a transparent exterior. Copy it losslessly;
// never threshold white pixels (the typography and ornaments must stay intact).
import { copyFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
const root = new URL('../', import.meta.url)
const source = new URL('public/tickets/mystery-source.png', root)
const output = new URL('public/tickets/mystery-ticket.png', root)
let original
try { original = await readFile(source) } catch { throw Error('Place the unchanged supplied original in public/tickets/mystery-source.png first. No substitute artwork will be generated.') }
const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
assert.equal(info.width, 1942); assert.equal(info.height, 809)
const alpha = (x, y) => data[(y * info.width + x) * 4 + 3]
// The original has 14 black border pixels at alpha 1/255; retain this nearly
// invisible source detail instead of altering any supplied pixels.
for (let x = 0; x < info.width; x++) { assert.ok(alpha(x, 0) <= 1); assert.ok(alpha(x, info.height - 1) <= 1) }
for (let y = 0; y < info.height; y++) { assert.ok(alpha(0, y) <= 1); assert.ok(alpha(info.width - 1, y) <= 1) }
assert.ok(data.some((value, i) => i % 4 === 3 && value === 255), 'Missing opaque ticket artwork')
await copyFile(source, output)
assert.ok((await readFile(output)).equals(original), 'The dedicated asset must preserve every original byte')
console.log(JSON.stringify({ asset: 'public/tickets/mystery-ticket.png', width: info.width, height: info.height,
  exteriorTransparent: true, losslessOriginal: true, sha256: createHash('sha256').update(original).digest('hex'), assignableEdition: false }))
