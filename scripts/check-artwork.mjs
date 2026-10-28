import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const collection = JSON.parse(await readFile(new URL('src/config/ticket-collection.json', root), 'utf8'))
const ids = new Set(), files = new Set(), hashes = new Set()
assert.equal(collection.editions.length, collection.expectedOriginalCount, 'Original collection is incomplete')
for (const edition of collection.editions) {
  const { id, file, width, height, perforation, qr, hingeY, paperColor } = edition
  assert.ok(id && edition.name && !ids.has(id), `Missing/duplicate edition ID: ${id}`)
  assert.ok(file.startsWith('tickets/') && !file.includes('..') && !files.has(file), `Invalid/duplicate artwork path: ${file}`)
  ids.add(id); files.add(file)
  const bytes = await readFile(new URL(`public/${file}`, root))
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${id}: expected original PNG`)
  assert.equal(bytes.readUInt32BE(16), width, `${id}: wrong canvas width`)
  assert.equal(bytes.readUInt32BE(20), height, `${id}: wrong canvas height`)
  const hash = createHash('sha256').update(bytes).digest('hex')
  assert.ok(!hashes.has(hash), `${id}: duplicate artwork bytes`)
  hashes.add(hash)
  assert.ok(perforation > .1 && perforation < .9, `${id}: invalid perforation`)
  assert.ok(hingeY > .8 && hingeY <= 1, `${id}: hinge must remain at the lower edge`)
  assert.match(paperColor, /^#[\da-f]{6}$/i)
  assert.ok(Object.values(qr).every(Number.isFinite), `${id}: invalid QR coordinates`)
  assert.ok(qr.x >= width * perforation && qr.y >= 0 && qr.width > 0 && qr.height > 0, `${id}: QR must lie inside its stub`)
  assert.ok(qr.x + qr.width <= width && qr.y + qr.height <= height, `${id}: QR outside canvas`)
  console.log(`${id}: ${width}×${height}, SHA-256 ${hash}`)
}
const presentationOnly = new Set(['mystery-source.png', 'mystery-ticket.png'])
const originals = (await readdir(new URL('public/tickets/', root))).filter(file => file.endsWith('.png') && !presentationOnly.has(file))
assert.equal(originals.length, files.size, 'Unregistered PNG files: review the complete artwork inventory')
console.log(`Verified ${ids.size}/${collection.expectedOriginalCount} unique original PNGs, canvas dimensions, QR bounds and lower attachment positions.`)
