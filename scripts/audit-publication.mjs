// Scan every reachable Git blob and every non-ignored working file before push.
// Report paths/checks only, never matched credential values.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const findings = []
const forbiddenPath = /(^|\/)(\.env(?!\.example$)[^/]*|[^/]+\.local|\.artifacts|\.aws|\.codex)(\/|$)/
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{15,}/,
  /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]{8,}@/,
  /hm1_[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/,
]
function scan(label, content) {
  if (forbiddenPath.test(label)) findings.push({ file: label, check: 'sensitive local path' })
  if (/\.(?:png|woff2?|jpg|ico)$/.test(label)) return
  if (patterns.some(pattern => pattern.test(content))) findings.push({ file: label, check: 'credential pattern' })
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role === 'service_role') findings.push({ file: label, check: 'service-role JWT' }) } catch { /* Source regexes are not tokens. */ }
  }
}
const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
for (const file of files) scan(file, readFileSync(file, 'utf8'))
const objects = git('rev-list', '--objects', '--all').trim().split('\n')
let blobs = 0
for (const entry of objects) {
  const space = entry.indexOf(' '), hash = entry.slice(0, space), file = entry.slice(space + 1)
  if (space < 0 || git('cat-file', '-t', hash).trim() !== 'blob') continue
  blobs++; scan(file, git('cat-file', 'blob', hash))
}
if (findings.length) { console.log(JSON.stringify({ passed: false, findings })); process.exitCode = 1 }
else console.log(JSON.stringify({ passed: true, workingFiles: files.length, historyBlobs: blobs, checks: 'sensitive paths, backend/API secrets, private keys, database passwords, bearer QR credentials' }))
