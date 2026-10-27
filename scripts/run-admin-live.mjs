// Local test orchestrator. Consumes and immediately removes an ignored fixture.
// Passwords never appear in shell arguments, stdout, or source control.
import { createInterface } from 'node:readline'
import { readFile, unlink } from 'node:fs/promises'
import { prepareAdminRevocationCheck, runAdminLiveTests } from './test-admin-live.mjs'
const lines = createInterface({ input: process.stdin })
try {
  const fixtureFile = new URL('../.artifacts/phase3-test-auth.json', import.meta.url)
  const credentials = JSON.parse(await readFile(fixtureFile, 'utf8'))
  await unlink(fixtureFile)
  const revokeOnly = process.argv.includes('--revocation-check')
  const tests = revokeOnly ? await prepareAdminRevocationCheck(credentials) : await runAdminLiveTests(credentials)
  console.log(JSON.stringify({ event: revokeOnly ? 'ready-for-revocation' : 'completed', ...('report' in tests ? tests.report : {}) }))
  for await (const line of lines) {
    if (line === 'verify-revoked') {
      console.log(JSON.stringify({ event: 'revoked', ...await tests.verifyRevoked() }))
      lines.close(); break
    }
  }
} catch (error) {
  console.log(JSON.stringify({ event: 'failed', error: error instanceof Error ? error.message : 'Live checks failed' }))
  process.exitCode = 1; lines.close()
}
