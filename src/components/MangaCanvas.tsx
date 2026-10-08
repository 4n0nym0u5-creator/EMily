import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createBubble, createPanel, createSfx, nextZ, updateElement } from '../lib/elements'
import { fileToDataUrl, imageFilesFromList } from '../lib/images'
import { normalizeRect } from '../lib/geometry'
import type { CanvasElement, CreatorTool } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { PageFrame } from './PageFrame'

export interface MangaCanvasHandle {
  clientToCanvas: (clientX: number, clientY: number) => { x: number; y: number } | null
}

interface DragState {
  mode: 'move' | 'resize' | 'draw'
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
    }
    onSelect(element.id)
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  const onResizePointerDown = (event: ReactPointerEvent, element: CanvasElement) => {
    event.stopPropagation()
    const point = pointFrom(event.clientX, event.clientY)
    if (!point) return
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
    if (current.mode === 'move') {
      if (Math.hypot(point.x - current.startX, point.y - current.startY) > 3) current.moved = true
      emitLive(updateElement(latest.current, current.id, { x: point.x - current.offsetX, y: point.y - current.offsetY }))
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

  const onPointerUp = () => {
    const current = drag.current
    if (!current) return
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
      onPointerDownCapture={onCreate}
      onPointerDown={(event) => {
        if (tool !== 'select') return
        if (event.target !== event.currentTarget) return
        onSelect(null)
        onEdit(null)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
