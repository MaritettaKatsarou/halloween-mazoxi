import { useEffect, useState } from 'react'
import { preloadArtwork } from '../lib/preloadArtwork'

/** A changed URL is never reported ready using the previous image's state. */
export function useArtwork(src: string | null) {
  const [state, setState] = useState<{ src: string | null; error: string | null }>({ src: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!src) return
    let current = true
    void preloadArtwork(src).then(() => {
      if (current) setState({ src, error: null })
    }, error => {
      if (current) setState({ src, error: error instanceof Error ? error.message : 'Artwork is unavailable. Please retry.' })
    })
    return () => { current = false }
  }, [src, revision])
  return { ready: !!src && state.src === src && !state.error, error: state.src === src ? state.error : null,
    retry: () => { setState({ src: null, error: null }); setRevision(value => value + 1) } }
}
