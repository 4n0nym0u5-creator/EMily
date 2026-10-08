import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createBubble, createPanel, createSfx, nextZ, updateElement } from '../lib/elements'
import { fileToDataUrl, imageFilesFromList } from '../lib/images'
import { frameFromRect, withFrame, FRAME_SCALE_MAX, FRAME_SCALE_MIN } from '../lib/frame'
import { findPanelAt, normalizeRect } from '../lib/geometry'
import type { CanvasElement, CreatorTool, FrameView } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { PageFrame } from './PageFrame'

export interface MangaCanvasHandle {
  clientToCanvas: (clientX: number, clientY: number) => { x: number; y: number } | null
}

interface DragState {
  mode: 'move' | 'resize' | 'draw' | 'pinch'
  id?: string
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  x: number
  y: number
  moved: boolean
  wasSelected: boolean
  orig: { x: number; y: number; width: number; height: number }
  origFrame?: FrameView
  pinchDist?: number
  pinchScale?: number
}

interface MangaCanvasProps {
  elements: CanvasElement[]
  tool: CreatorTool
  sfxWord: string
  selectedId: string | null
  editingId: string | null
  onLive: (elements: CanvasElement[]) => void
  onCommit: (elements: CanvasElement[]) => void
  onSelect: (id: string | null) => void
  onEdit: (id: string | null) => void
  onDropFile: (src: string, point: { x: number; y: number }) => void
  onPlaced: () => void
}

export const MangaCanvas = forwardRef<MangaCanvasHandle, MangaCanvasProps>(function MangaCanvas(
  { elements, tool, sfxWord, selectedId, editingId, onLive, onCommit, onSelect, onEdit, onDropFile, onPlaced },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null)
  const latest = useRef(elements)
  const drag = useRef<DragState | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [draftPanel, setDraftPanel] = useState<DragState['orig'] | null>(null)
  useLayoutEffect(() => {
    latest.current = elements
  })

  const pointFrom = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return null
    const rect = stage.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  useImperativeHandle(ref, () => ({
    clientToCanvas(clientX: number, clientY: number) {
      const stage = stageRef.current
      if (!stage) return null
      const rect = stage.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
      return pointFrom(clientX, clientY)
    },
  }))

  const emitLive = (next: CanvasElement[]) => {
    latest.current = next
    onLive(next)
  }
  const emitCommit = (next: CanvasElement[]) => {
    latest.current = next
    onCommit(next)
  }

  const onCreate = (event: ReactPointerEvent) => {
    if (tool === 'select') return
    const target = event.target as HTMLElement
    if (target.closest('textarea, input, .resize-handle, .panel-tab')) return
    const point = pointFrom(event.clientX, event.clientY)
    if (!point) return
    event.stopPropagation()
    if (tool === 'panel') {
      drag.current = {
        mode: 'draw',
        offsetX: 0,
        offsetY: 0,
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
        moved: false,
        wasSelected: false,
        orig: { x: point.x, y: point.y, width: 0, height: 0 },
      }
      stageRef.current?.setPointerCapture(event.pointerId)
      onSelect(null)
      return
    }
    const z = nextZ(latest.current)
    if (tool === 'speech' || tool === 'thought') {
      const bubble = createBubble(point.x, point.y, tool === 'thought' ? 'thought' : 'speech', z)
      emitCommit([...latest.current, bubble])
      onSelect(bubble.id)
      onEdit(bubble.id)
      onPlaced()
      return
    }
    const sfx = createSfx(point.x, point.y, sfxWord, z)
    emitCommit([...latest.current, sfx])
    onSelect(sfx.id)
    onEdit(sfx.id)
    onPlaced()
  }

  const onElementPointerDown = (event: ReactPointerEvent, element: CanvasElement) => {
    if (tool !== 'select') return
    if (editingId === element.id) return
    if (pointers.current.size > 1) return
    event.stopPropagation()
    const point = pointFrom(event.clientX, event.clientY)
    if (!point) return
    drag.current = {
      mode: 'move',
      id: element.id,
      offsetX: point.x - element.x,
      offsetY: point.y - element.y,
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      moved: false,
      wasSelected: selectedId === element.id,
      orig: element,
      origFrame: element.kind === 'image' ? element.frame : undefined,
    }
    onSelect(element.id)
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  const onResizePointerDown = (event: ReactPointerEvent, element: CanvasElement) => {
    event.stopPropagation()
    const point = pointFrom(event.clientX, event.clientY)
    if (!point) return
    const panel =
      element.kind === 'image' && element.panelId
        ? latest.current.find((item) => item.kind === 'panel' && item.id === element.panelId)
        : undefined
    drag.current = {
      mode: 'resize',
      id: element.id,
      offsetX: 0,
      offsetY: 0,
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      moved: false,
      wasSelected: true,
      orig: { x: element.x, y: element.y, width: element.width, height: element.height },
      origFrame:
        element.kind === 'image' && panel && panel.kind === 'panel'
          ? (element.frame ?? frameFromRect(element, panel))
          : undefined,
    }
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current
    if (!current) return
    const point = pointFrom(event.clientX, event.clientY)
    if (!point) return
    if (current.mode === 'draw') {
      current.x = point.x
      current.y = point.y
      current.moved = true
      setDraftPanel(normalizeRect(current.startX, current.startY, point.x, point.y))
      return
    }
    if (!current.id) return
    if (current.mode === 'pinch' && current.id) {
      const points = [...pointers.current.values()]
      if (points.length < 2 || !current.pinchDist || !current.pinchScale) return
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      const image = latest.current.find((item) => item.id === current.id)
      const panel = image && image.kind === 'image' && image.panelId
        ? latest.current.find((item) => item.kind === 'panel' && item.id === image.panelId)
        : undefined
      if (!image || image.kind !== 'image' || !panel || panel.kind !== 'panel') return
      const frame = { ...(image.frame ?? frameFromRect(image, panel)), scale: Math.min(FRAME_SCALE_MAX, Math.max(FRAME_SCALE_MIN, current.pinchScale * (dist / current.pinchDist))) }
      current.moved = true
      emitLive(updateElement(latest.current, image.id, withFrame(image, panel, frame)))
      return
    }
    if (current.mode === 'move') {
      if (Math.hypot(point.x - current.startX, point.y - current.startY) > 3) current.moved = true
      current.x = point.x
      current.y = point.y
      const image = latest.current.find((item) => item.id === current.id)
      const panel = image && image.kind === 'image' && image.panelId
        ? latest.current.find((item) => item.kind === 'panel' && item.id === image.panelId)
        : undefined
      if (image && image.kind === 'image' && panel && panel.kind === 'panel') {
        const base = current.origFrame ?? frameFromRect({ ...image, ...current.orig }, panel)
        const frame = { ...base, x: base.x + (point.x - current.startX), y: base.y + (point.y - current.startY) }
        emitLive(updateElement(latest.current, image.id, withFrame(image, panel, frame)))
        return
      }
      emitLive(updateElement(latest.current, current.id, { x: point.x - current.offsetX, y: point.y - current.offsetY }))
      return
    }
    const resizing = latest.current.find((item) => item.id === current.id)
    const resizePanel =
      resizing && resizing.kind === 'image' && resizing.panelId
        ? latest.current.find((item) => item.kind === 'panel' && item.id === resizing.panelId)
        : undefined
    if (resizing && resizing.kind === 'image' && resizePanel && resizePanel.kind === 'panel' && current.origFrame) {
      const cx = resizePanel.x + resizePanel.width / 2 + current.origFrame.x
      const cy = resizePanel.y + resizePanel.height / 2 + current.origFrame.y
      const startDist = Math.max(24, Math.hypot(current.startX - cx, current.startY - cy))
      const dist = Math.max(24, Math.hypot(point.x - cx, point.y - cy))
      const frame = {
        ...current.origFrame,
        scale: Math.min(FRAME_SCALE_MAX, Math.max(FRAME_SCALE_MIN, current.origFrame.scale * (dist / startDist))),
      }
      current.moved = true
      emitLive(updateElement(latest.current, resizing.id, withFrame(resizing, resizePanel, frame)))
      return
    }
    const cx = current.orig.x + current.orig.width / 2
    const cy = current.orig.y + current.orig.height / 2
    const startDist = Math.max(24, Math.hypot(current.startX - cx, current.startY - cy))
    const dist = Math.max(24, Math.hypot(point.x - cx, point.y - cy))
    const factor = dist / startDist
    const width = Math.min(CANVAS_WIDTH * 1.4, Math.max(48, current.orig.width * factor))
    const height = Math.min(CANVAS_HEIGHT * 1.4, Math.max(48, current.orig.height * factor))
    current.moved = true
    emitLive(
      updateElement(latest.current, current.id, {
        width,
        height,
        x: cx - width / 2,
        y: cy - height / 2,
      }),
    )
  }

  const endDrag = (pointerId?: number) => {
    if (pointerId !== undefined) pointers.current.delete(pointerId)
    const current = drag.current
    if (!current) return
    if (current.mode === 'pinch' && pointers.current.size >= 1) {
      const remaining = [...pointers.current.values()][0]
      const image = current.id ? latest.current.find((item) => item.id === current.id) : undefined
      current.mode = 'move'
      if (remaining) {
        current.startX = remaining.x
        current.startY = remaining.y
        current.x = remaining.x
        current.y = remaining.y
      }
      if (image && image.kind === 'image') current.origFrame = image.frame
      return
    }
    drag.current = null
    if (current.mode === 'draw') {
      const rect = normalizeRect(current.startX, current.startY, current.x, current.y)
      setDraftPanel(null)
      if (rect.width > 28 && rect.height > 28) {
        const panel = createPanel(rect)
        emitCommit([...latest.current, panel])
        onSelect(panel.id)
      }
      return
    }
    if (current.moved && current.id) {
      const image = latest.current.find((item) => item.id === current.id)
      const panels = latest.current.filter((item) => item.kind === 'panel')
      const landed = findPanelAt(panels, current.x, current.y)
      if (image && image.kind === 'image' && image.frame && landed && landed.id !== image.panelId) {
        emitCommit(updateElement(latest.current, image.id, withFrame(image, landed, { ...image.frame, x: 0, y: 0 })))
        return
      }
      emitCommit(latest.current)
      return
    }
    if (current.wasSelected && current.id) {
      const element = latest.current.find((item) => item.id === current.id)
      if (element && (element.kind === 'bubble' || element.kind === 'sfx')) onEdit(element.id)
    }
  }

  return (
    <div
      ref={stageRef}
      className={`manga-stage tool-${tool}`}
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      onPointerDownCapture={(event) => {
        const point = pointFrom(event.clientX, event.clientY)
        if (point) pointers.current.set(event.pointerId, point)
        const active = drag.current
        if (tool === 'select' && pointers.current.size === 2 && active?.mode === 'move' && active.id) {
          const points = [...pointers.current.values()]
          const image = latest.current.find((item) => item.id === active.id)
          if (image && image.kind === 'image' && image.panelId && points.length >= 2) {
            active.mode = 'pinch'
            active.pinchDist = Math.max(12, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y))
            active.pinchScale = image.frame?.scale ?? active.origFrame?.scale ?? 1
            active.moved = true
            stageRef.current?.setPointerCapture(event.pointerId)
          }
        }
        if (pointers.current.size > 1) return
        onCreate(event)
      }}
      onPointerDown={(event) => {
        if (tool !== 'select') return
        if (pointers.current.size > 1) return
        if (event.target !== event.currentTarget) return
        onSelect(null)
        onEdit(null)
      }}
      onPointerMove={(event) => {
        const point = pointFrom(event.clientX, event.clientY)
        if (point) pointers.current.set(event.pointerId, point)
        onPointerMove(event)
      }}
      onPointerUp={(event) => endDrag(event.pointerId)}
      onPointerCancel={(event) => endDrag(event.pointerId)}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const file = imageFilesFromList(event.dataTransfer.files)[0]
        const point = pointFrom(event.clientX, event.clientY)
        if (!file || !point) return
        void fileToDataUrl(file).then((src) => onDropFile(src, point))
      }}
    >
      <div className="manga-paper" />
      <PageFrame
        elements={elements}
        selectedId={selectedId}
        editingId={editingId}
        interactive
        draftPanel={draftPanel}
        onElementPointerDown={onElementPointerDown}
        onResizePointerDown={onResizePointerDown}
        onTextChange={(id, text) => emitLive(updateElement(latest.current, id, { text }))}
        onEditBlur={() => {
          emitCommit(latest.current)
          onEdit(null)
        }}
      />
    </div>
  )
})
