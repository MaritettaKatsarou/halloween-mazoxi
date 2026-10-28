const decoded = new Map<string, Promise<void>>()

/** Do not publish an owned artwork to React until the browser can paint it. */
export function preloadArtwork(src: string): Promise<void> {
  const existing = decoded.get(src)
  if (existing) return existing
  const result = new Promise<void>((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(() => fail(), 30000)
    const fail = () => { window.clearTimeout(timer); reject(new Error('The ticket artwork could not load. Check your connection and retry.')) }
    image.decoding = 'async'
    image.onerror = fail
    image.onload = () => {
      const ready = typeof image.decode === 'function' ? image.decode() : Promise.resolve()
      void ready.then(() => {
        if (!image.naturalWidth || !image.naturalHeight) { fail(); return }
        window.clearTimeout(timer); resolve()
      }, fail)
    }
    image.src = src
  })
  decoded.set(src, result)
  void result.catch(() => { if (decoded.get(src) === result) decoded.delete(src) })
  return result
}
