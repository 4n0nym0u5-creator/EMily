import { useEffect, useRef, useState } from 'react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [mirror, setMirror] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    void navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop())
          return
        }
        stream = next
        setError(null)
        if (videoRef.current) {
          videoRef.current.srcObject = next
          void videoRef.current.play().catch(() => undefined)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('The camera did not open. You can choose a picture from your library instead.')
        }
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [facing])

  const snap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const longest = Math.max(video.videoWidth, video.videoHeight)
    const scale = Math.min(1, 1600 / longest)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return
    if (mirror) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div className="camera-panel">
      <div className="camera-stage">
        <video ref={videoRef} playsInline muted autoPlay className={mirror ? 'mirrored' : ''} />
      </div>
      {error && <p className="asset-error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn" onClick={() => setMirror((value) => !value)}>
          {mirror ? 'Mirror on' : 'Mirror off'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setFacing((value) => (value === 'user' ? 'environment' : 'user'))}
        >
          Flip camera
        </button>
        <button type="button" className="btn btn-primary" onClick={snap} disabled={Boolean(error)}>
          Take picture
        </button>
      </div>
    </div>
  )
}
