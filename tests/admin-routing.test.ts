import { describe, expect, it } from 'vitest'
import { resolveRoute } from '../src/routing'
import { createScanLatch } from '../src/admin/scanLatch'
describe('static admin routes and scanner latch', () => {
  it('supports hash routes and direct admin links under the GitHub Pages base', () => {
    for (const route of ['login', 'scan', 'dashboard', 'history']) {
      expect(resolveRoute(`#/admin/${route}`, '/halloween-mazoxi/', '/halloween-mazoxi/')).toBe(`/admin/${route}`)
      expect(resolveRoute('', `/halloween-mazoxi/admin/${route}`, '/halloween-mazoxi/')).toBe(`/admin/${route}`)
    }
    expect(resolveRoute('', '/halloween-mazoxi/', '/halloween-mazoxi/')).toBe('/')
  })
  it('emits one result per camera session and requires a new latch for SCAN NEXT', () => {
    const values: string[] = []
    const accept = createScanLatch(value => values.push(value))
    expect(accept('')).toBe(false)
    expect(accept('first')).toBe(true)
    expect(accept('first')).toBe(false)
    expect(accept('second')).toBe(false)
    expect(values).toEqual(['first'])
    expect(createScanLatch(value => values.push(value))('second')).toBe(true)
  })
})
