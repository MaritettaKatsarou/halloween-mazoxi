import { readFile, unlink } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { runRealtimeLiveTests } from './test-realtime-live.mjs'
const commands = createInterface({ input: process.stdin })
const queue = [], waiters = []
commands.on('line', line => { const next = waiters.shift(); if (next) next(line); else queue.push(line) })
try {
  const file = new URL('../.artifacts/phase4-test-auth.json', import.meta.url)
  const credentials = JSON.parse(await readFile(file, 'utf8'))
  await unlink(file)
  const report = await runRealtimeLiveTests(credentials, async snapshot => {
    console.log(JSON.stringify(snapshot))
    const command = queue.length ? queue.shift() : await new Promise(resolve => waiters.push(resolve))
    if (command !== 'continue') throw Error('Rollback checkpoint not acknowledged')
  })
  console.log(JSON.stringify(report))
} catch (error) { console.log(error instanceof Error ? error.message : 'Hosted Realtime checks failed'); process.exitCode = 1 }
finally { commands.close() }
