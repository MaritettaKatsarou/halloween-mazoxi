import { useEffect, useRef, useState } from 'react'
import { createScanLatch } from './scanLatch'

export function CameraScanner({ onDetected, startImmediately = false }: { onDetected: (credential: string) => void; startImmediately?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(startImmediately)
  const [error, setError] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torch, setTorch] = useState(false)
  useEffect(() => {
    if (!active) return
    let cancelled = false, frame = 0, previous = 0
    let ownedStream: MediaStream | null = null
    const stop = () => { ownedStream?.getTracks().forEach(track => track.stop()); if (stream.current === ownedStream) stream.current = null; cancelAnimationFrame(frame) }
    const accept = createScanLatch(value => { stop(); onDetected(value) })
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Error('HTTPS or localhost is required to use the camera.')
        const camera = await navigator.mediaDevices.getUserMedia({ video: {
          facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 },
        }, audio: false })
        if (cancelled || !video.current) { camera.getTracks().forEach(track => track.stop()); return }
        ownedStream = camera; stream.current = camera
        video.current.srcObject = camera
        await video.current.play()
        if (cancelled) return
        const track = camera.getVideoTracks()[0]
        const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
        setTorchSupported(capabilities?.torch === true)
        const { default: jsQR } = await import('jsqr')
        if (cancelled) return
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw Error('Camera decoding is unavailable in this browser.')
        const scan = (time: number) => {
          if (cancelled || !stream.current || !video.current) return
          if (time - previous >= 180 && video.current.readyState >= 2 && video.current.videoWidth) {
            previous = time
            const scale = Math.min(1, 720 / video.current.videoWidth)
            canvas.width = Math.round(video.current.videoWidth * scale)
            canvas.height = Math.round(video.current.videoHeight * scale)
            try {
              context.drawImage(video.current, 0, 0, canvas.width, canvas.height)
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })
              if (code && accept(code.data)) return
            } catch {
              stop(); setError('The camera was interrupted. Start it again to continue.'); setActive(false); return
            }
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch (error) {
        stop()
        if (!cancelled) {
          setError(error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in browser settings, then retry.'
            : error instanceof DOMException && error.name === 'NotFoundError'
              ? 'No camera was found. You can paste the QR credential below.'
              : error instanceof Error ? error.message : 'Camera could not start.')
          setActive(false)
        }
      }
    }
    const hide = () => { if (document.visibilityState === 'hidden') { stop(); setActive(false) } }
    document.addEventListener('visibilitychange', hide)
    void start()
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', hide) }
  }, [active, onDetected])
  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch { setError('The camera could not change its light setting.') }
  }
  return <div className="camera-scanner">
    <div className="camera-window"><video ref={video} muted playsInline aria-label="Rear camera QR preview" /><div className="camera-frame" aria-hidden="true" />{!active && <p>Hold a guest’s QR inside the frame.</p>}</div>
    <div className="admin-button-row"><button className="admin-primary" onClick={() => { setError(null); setTorch(false); setTorchSupported(false); setActive(!active) }}>{active ? 'STOP CAMERA' : 'START CAMERA'}</button>{active && torchSupported && <button className="admin-secondary" aria-pressed={torch} onClick={() => void toggleTorch()}>{torch ? 'LIGHT OFF' : 'LIGHT ON'}</button>}</div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <p className="admin-hint">The camera pauses after detection. Admission always needs your confirmation.</p>
  </div>
}
