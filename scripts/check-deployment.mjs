// HTTP and actual PNG decoding checks; does not claim browser/camera testing.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import sharp from 'sharp'
const root = new URL('../', import.meta.url)
const site = new URL(process.argv[2] || '')
assert.equal(site.protocol, 'https:')
assert.equal(site.hostname.toLowerCase(), 'maritettakatsarou.github.io')
assert.equal(site.pathname, '/halloween-mazoxi/')
const collection = JSON.parse(await readFile(new URL('src/config/ticket-collection.json', root), 'utf8'))
const checks = []
async function get(url, contentType) {
  const response = await fetch(url, { cache: 'no-store' })
  assert.equal(response.status, 200, `HTTP failure: ${url}`)
  assert.match(response.headers.get('content-type') || '', contentType)
  return response
}
const html = await (await get(site, /text\/html/)).text()
assert.match(html, /<div id="root"><\/div>/)
const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\/assets\/[^"\s]+)"/g)].map(match => match[1])
assert.ok(assets.length >= 2, 'Missing production JS/CSS entry assets')
for (const path of assets) {
  assert.ok(path.startsWith('/halloween-mazoxi/assets/'))
  const response = await get(new URL(path, site), path.endsWith('.css') ? /text\/css/ : /javascript/)
  if (path.endsWith('.js')) assert.doesNotMatch(await response.text(), /Simulate admission|Reset simulation|sb_secret_[A-Za-z0-9_-]{15,}/)
}
checks.push('HTTPS landing HTML and production JS/CSS under the correct base path')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
for (const edition of collection.editions) {
  const url = site.href + encodeURI(edition.file)
  const bytes = Buffer.from(await (await get(url, /image\/png/)).arrayBuffer())
  const original = await readFile(new URL(`public/${edition.file}`, root))
  assert.equal(hash(bytes), hash(original), `${edition.id}: deployed artwork differs`)
  const { info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, edition.width); assert.equal(info.height, edition.height)
  checks.push(`${edition.id}: HTTP 200, original PNG bytes and successful native-size decoding`)
}
for (const route of ['#/admin/login', '#/admin/scan', '#/admin/dashboard']) await get(new URL(route, site), /text\/html/)
const fallback = await fetch(new URL('admin/login', site))
assert.equal(fallback.status, 404)
assert.match(await fallback.text(), /location\.replace/)
checks.push('Hash route document access and GitHub Pages direct-path recovery document')
for (const fn of ['guest-ticket', 'admin-ticket']) {
  const response = await fetch(`https://hefzzwfmpdukwceuwgqr.supabase.co/functions/v1/${fn}`, { method: 'OPTIONS', headers: {
    Origin: site.origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info',
  } })
  assert.equal(response.status, 204)
  assert.ok(['*', site.origin].includes(response.headers.get('access-control-allow-origin')))
  for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) assert.ok(response.headers.get('access-control-allow-headers')?.toLowerCase().includes(header))
  checks.push(`${fn}: Pages-origin CORS preflight permits required authenticated-request headers`)
}
console.log(JSON.stringify({ passed: true, site: site.href, checks, limitations: 'No rendered DOM, browser sessions, animation, camera, QR scanning or physical-device assertions.' }))
