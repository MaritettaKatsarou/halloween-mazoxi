import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
class TestImage {
  static instances: TestImage[] = []
  src = ''; decoding = ''; naturalWidth = 1942; naturalHeight = 809
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  decode = vi.fn(async () => {})
  constructor() { TestImage.instances.push(this) }
}
beforeEach(() => { vi.resetModules(); TestImage.instances = []; vi.stubGlobal('Image', TestImage); vi.stubGlobal('window', globalThis) })
afterEach(() => vi.unstubAllGlobals())
describe('decode before artwork publication', () => {
  it('waits for decoding and caches successfully decoded URLs', async () => {
    const { preloadArtwork } = await import('../src/lib/preloadArtwork')
    let decode!: () => void, finished = false
    const pending = preloadArtwork('/actual.png'); const image = TestImage.instances[0]
    image.decode.mockImplementationOnce(() => new Promise(resolve => { decode = resolve }))
    void pending.then(() => { finished = true }); image.onload?.(); await Promise.resolve()
    expect(finished).toBe(false); decode(); await pending
    expect(preloadArtwork('/actual.png')).toBe(pending); expect(TestImage.instances).toHaveLength(1)
  })
  it('removes a failed request so explicit recovery can retry it', async () => {
    const { preloadArtwork } = await import('../src/lib/preloadArtwork')
    const failed = preloadArtwork('/retry.png'); TestImage.instances[0].onerror?.()
    await expect(failed).rejects.toThrow('artwork could not load')
    const recovered = preloadArtwork('/retry.png'); expect(TestImage.instances).toHaveLength(2)
    TestImage.instances[1].onload?.(); await recovered
  })
  it('rejects zero-dimensional or undecodable images', async () => {
    const { preloadArtwork } = await import('../src/lib/preloadArtwork')
    const pending = preloadArtwork('/broken.png'); TestImage.instances[0].naturalWidth = 0; TestImage.instances[0].onload?.()
    await expect(pending).rejects.toThrow()
  })
})
