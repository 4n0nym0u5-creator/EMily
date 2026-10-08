import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { loadImage } from '../lib/images'

interface CropperProps {
  src: string
  onCancel: () => void
  onUseWhole: () => void
  onCrop: (dataUrl: string) => void
}

export function Cropper({ src, onCancel, onUseWhole, onCrop }: CropperProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState({ w: 300, h: 400 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadImage(src)
      .then((image) => {
        if (cancelled) return
        imageRef.current = image
        setNatural({ w: image.width, h: image.height })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const center = (width: number, height: number) => {
      if (!imageRef.current) return
      const cover = Math.max(width / imageRef.current.width, height / imageRef.current.height)
      const displayW = imageRef.current.width * cover
      const displayH = imageRef.current.height * cover
      setZoom(1)
      setOffset(clampOffset(width, height, displayW, displayH, (width - displayW) / 2, (height - displayH) / 2))
    }
    const measure = () => {
      const rect = node.getBoundingClientRect()
      setFrame({ w: rect.width, h: rect.height })
      center(rect.width, rect.height)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [natural])

  const base = natural ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1
  const displayW = natural ? natural.w * base * zoom : 0
  const displayH = natural ? natural.h * base * zoom : 0

  const applyZoom = (nextZoom: number) => {
    if (!natural) return
    const next = Math.min(3, Math.max(1, nextZoom))
    const currentW = natural.w * base * zoom
    const currentH = natural.h * base * zoom
    const nextW = natural.w * base * next
    const nextH = natural.h * base * next
    const centerX = (frame.w / 2 - offset.x) / Math.max(1, currentW)
    const centerY = (frame.h / 2 - offset.y) / Math.max(1, currentH)
    setZoom(next)
    setOffset(
      clampOffset(frame.w, frame.h, nextW, nextH, frame.w / 2 - centerX * nextW, frame.h / 2 - centerY * nextH),
    )
  }

  const onPointerDown = (event: ReactPointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size === 2) {
      pinch.current = { distance: pointerDistance(pointers.current), zoom }
      pan.current = null
      return
    }
    pan.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!pointers.current.has(event.pointerId) || !natural) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const distance = pointerDistance(pointers.current)
      if (pinch.current.distance > 0) applyZoom(pinch.current.zoom * (distance / pinch.current.distance))
      return
    }
    if (!pan.current) return
    const width = natural.w * base * zoom
    const height = natural.h * base * zoom
    setOffset(
      clampOffset(
        frame.w,
        frame.h,
        width,
        height,
        pan.current.ox + (event.clientX - pan.current.x),
        pan.current.oy + (event.clientY - pan.current.y),
      ),
    )
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    pan.current = null
  }

  const crop = () => {
    const image = imageRef.current
    if (!image || !natural) return
    const sx = -offset.x / (base * zoom)
    const sy = -offset.y / (base * zoom)
    const sw = frame.w / (base * zoom)
    const sh = frame.h / (base * zoom)
    const outW = 1000
    const outH = Math.max(1, Math.round(outW * (frame.h / Math.max(1, frame.w))))
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH)
    onCrop(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div className="cropper">
      <p className="asset-help">Drag the picture so the face sits in the frame. Pinch or use the slider to zoom.</p>
      <div
        ref={frameRef}
        className="crop-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {natural && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ width: displayW, height: displayH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
          />
        )}
      </div>
      {failed && <p className="asset-error">That picture did not open.</p>}
      <label className="zoom-row">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(event) => applyZoom(Number(event.target.value))}
        />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Back
        </button>
        <button type="button" className="btn" onClick={onUseWhole}>
          Use the whole picture
        </button>
        <button type="button" className="btn btn-primary" onClick={crop} disabled={!natural}>
          Use this crop
        </button>
      </div>
    </div>
  )
}

function clampOffset(frameW: number, frameH: number, displayW: number, displayH: number, x: number, y: number) {
  return {
    x: Math.min(0, Math.max(Math.min(0, frameW - displayW), x)),
    y: Math.min(0, Math.max(Math.min(0, frameH - displayH), y)),
  }
}

function pointerDistance(points: Map<number, { x: number; y: number }>) {
  const [a, b] = [...points.values()]
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}
