import type { PointerEvent as ReactPointerEvent } from 'react'

export function trackPointerDrag(
  event: ReactPointerEvent,
  handlers: {
    onMove: (x: number, y: number) => void
    onDrop: (x: number, y: number) => void
  },
) {
  if (event.button !== 0) return
  const startX = event.clientX
  const startY = event.clientY
  let moved = false
  const move = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) moved = true
    if (moved) handlers.onMove(ev.clientX, ev.clientY)
  }
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (moved) handlers.onDrop(ev.clientX, ev.clientY)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
