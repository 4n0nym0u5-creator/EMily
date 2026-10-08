import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  centerOf,
  findPanelAt,
  normalizeRect,
  snapImageToPanel,
} from '../lib/geometry'
import { newId } from '../lib/ids'
import type {
  BubbleElement,
  CanvasElement,
  CreatorTool,
  ImageElement,
  PanelElement,
  SfxElement,
} from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'

interface MangaCanvasProps {
  elements: CanvasElement[]
  tool: CreatorTool
  selectedId: string | null
  onChange: (elements: CanvasElement[]) => void
  onSelect: (id: string | null) => void
}

type DragState =
  | {
      mode: 'move'
      id: string
      offsetX: number
      offsetY: number
    }
  | {
      mode: 'resize'
      id: string
      startX: number
      startY: number
      orig: { x: number; y: number; width: number; height: number }
    }
  | {
      mode: 'draw-panel'
      startX: number
      startY: number
      currentX: number
      currentY: number
    }
  | null

const SFX_COLORS = ['#ff5a1f', '#111111', '#e11d48', '#2563eb', '#ca8a04']

function clientToCanvas(
  clientX: number,
  clientY: number,
  el: HTMLElement,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  }
}

function nextZ(elements: CanvasElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1
}

export function MangaCanvas({
  elements,
  tool,
  selectedId,
  onChange,
  onSelect,
}: MangaCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>) => {
      onChange(
        elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as CanvasElement) : el,
        ),
      )
    },
    [elements, onChange],
  )

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    if (!file.type.startsWith('image/')) return

    const src = await readFileAsDataUrl(file)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = src
    })

    const maxW = CANVAS_WIDTH * 0.55
    const maxH = CANVAS_HEIGHT * 0.45
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const width = img.width * scale
    const height = img.height * scale

    const element: ImageElement = {
      id: newId(),
      kind: 'image',
      src,
      x: (CANVAS_WIDTH - width) / 2,
      y: (CANVAS_HEIGHT - height) / 2,
      width,
      height,
      panelId: null,
      zIndex: nextZ(elements),
    }
    onChange([...elements, element])
    onSelect(element.id)
  }

  const onPointerDownStage = (e: ReactPointerEvent) => {
    if (!stageRef.current) return
    const { x, y } = clientToCanvas(e.clientX, e.clientY, stageRef.current)

    if (tool === 'panel') {
      setDrag({
        mode: 'draw-panel',
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      })
      onSelect(null)
      return
    }

    if (tool === 'bubble') {
      const bubble: BubbleElement = {
        id: newId(),
        kind: 'bubble',
        text: "I'm the next Little Giant!",
        style: 'speech',
        x: x - 90,
        y: y - 50,
        width: 180,
        height: 100,
        zIndex: nextZ(elements),
      }
      onChange([...elements, bubble])
      onSelect(bubble.id)
      setEditingId(bubble.id)
      return
    }

    if (tool === 'sfx') {
      const sfx: SfxElement = {
        id: newId(),
        kind: 'sfx',
        text: 'BA-DOOM',
        color: SFX_COLORS[Math.floor(Math.random() * SFX_COLORS.length)],
        rotation: -8 + Math.random() * 16,
        x: x - 80,
        y: y - 30,
        width: 220,
        height: 70,
        zIndex: nextZ(elements),
      }
      onChange([...elements, sfx])
      onSelect(sfx.id)
      setEditingId(sfx.id)
      return
    }

    // select tool: empty canvas click
    onSelect(null)
    setEditingId(null)
  }

  const onPointerDownElement = (
    e: ReactPointerEvent,
    el: CanvasElement,
  ) => {
    e.stopPropagation()
    if (tool !== 'select' && tool !== 'bubble' && tool !== 'sfx') return
    if (!stageRef.current) return

    const { x, y } = clientToCanvas(e.clientX, e.clientY, stageRef.current)
    onSelect(el.id)
    setDrag({
      mode: 'move',
      id: el.id,
      offsetX: x - el.x,
      offsetY: y - el.y,
    })
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || !stageRef.current) return
    const { x, y } = clientToCanvas(e.clientX, e.clientY, stageRef.current)

    if (drag.mode === 'draw-panel') {
      setDrag({ ...drag, currentX: x, currentY: y })
      return
    }

    if (drag.mode === 'move') {
      const nx = x - drag.offsetX
      const ny = y - drag.offsetY
      updateElement(drag.id, { x: nx, y: ny })
      return
    }

    if (drag.mode === 'resize') {
      const width = Math.max(40, drag.orig.width + (x - drag.startX))
      const height = Math.max(30, drag.orig.height + (y - drag.startY))
      updateElement(drag.id, { width, height })
    }
  }

  const onPointerUp = () => {
    if (!drag) return

    if (drag.mode === 'draw-panel') {
      const rect = normalizeRect(
        drag.startX,
        drag.startY,
        drag.currentX,
        drag.currentY,
      )
      if (rect.width > 24 && rect.height > 24) {
        const panel: PanelElement = {
          id: newId(),
          kind: 'panel',
          ...rect,
          zIndex: nextZ(elements),
        }
        const panels = [
          ...elements.filter((e): e is PanelElement => e.kind === 'panel'),
          panel,
        ]
        const next = elements.map((el) => {
          if (el.kind !== 'image') return el
          const c = centerOf(el)
          const hit = findPanelAt(panels, c.x, c.y)
          if (!hit) return { ...el, panelId: null }
          return { ...el, ...snapImageToPanel(hit), panelId: hit.id }
        })
        onChange([...next, panel])
        onSelect(panel.id)
      }
      setDrag(null)
      return
    }

    if (drag.mode === 'move') {
      const moved = elements.find((e) => e.id === drag.id)
      if (moved?.kind === 'image') {
        const panels = elements.filter((e): e is PanelElement => e.kind === 'panel')
        const c = centerOf({ ...moved, x: moved.x, y: moved.y })
        const hit = findPanelAt(panels, c.x, c.y)
        if (hit) {
          const box = snapImageToPanel(hit)
          updateElement(moved.id, { ...box, panelId: hit.id })
        } else {
          updateElement(moved.id, { panelId: null })
        }
      }
    }

    setDrag(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        e.preventDefault()
        onChange(elements.filter((el) => el.id !== selectedId))
        onSelect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId, selectedId, elements, onChange, onSelect])

  const draftPanel =
    drag?.mode === 'draw-panel'
      ? normalizeRect(drag.startX, drag.startY, drag.currentX, drag.currentY)
      : null

  const sorted = [...elements].sort((a, b) => {
    // panels under content for hit-testing visual; images clipped by panel
    if (a.kind === 'panel' && b.kind !== 'panel') return -1
    if (b.kind === 'panel' && a.kind !== 'panel') return 1
    return a.zIndex - b.zIndex
  })

  return (
    <div className="canvas-shell">
      <div className="canvas-upload-bar">
        <label className="btn btn-small btn-primary upload-label">
          Upload Image
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void handleUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <span className="canvas-hint">
          Tip: draw panels first, then Add to panel from AI Studio — characters snap in.
        </span>
      </div>

      <div
        className={`manga-stage tool-${tool}`}
        ref={stageRef}
        onPointerDown={onPointerDownStage}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      >
        <div className="manga-paper" />

        {sorted.map((el) => {
          const selected = el.id === selectedId
          const style: CSSProperties = {
            left: `${(el.x / CANVAS_WIDTH) * 100}%`,
            top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(el.width / CANVAS_WIDTH) * 100}%`,
            height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
            zIndex: el.zIndex + (el.kind === 'panel' ? 0 : 10),
          }

          if (el.kind === 'panel') {
            return (
              <div
                key={el.id}
                className={`el panel ${selected ? 'selected' : ''}`}
                style={style}
                onPointerDown={(e) => onPointerDownElement(e, el)}
              />
            )
          }

          if (el.kind === 'image') {
            return (
              <div
                key={el.id}
                className={`el image ${selected ? 'selected' : ''} ${el.panelId ? 'in-panel' : ''}`}
                style={style}
                onPointerDown={(e) => onPointerDownElement(e, el)}
              >
                <img src={el.src} alt="" draggable={false} />
                {selected && (
                  <button
                    type="button"
                    className="resize-handle"
                    aria-label="Resize"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      if (!stageRef.current) return
                      const { x, y } = clientToCanvas(
                        e.clientX,
                        e.clientY,
                        stageRef.current,
                      )
                      setDrag({
                        mode: 'resize',
                        id: el.id,
                        startX: x,
                        startY: y,
                        orig: {
                          x: el.x,
                          y: el.y,
                          width: el.width,
                          height: el.height,
                        },
                      })
                    }}
                  />
                )}
              </div>
            )
          }

          if (el.kind === 'bubble') {
            return (
              <div
                key={el.id}
                className={`el bubble style-${el.style} ${selected ? 'selected' : ''}`}
                style={style}
                onPointerDown={(e) => onPointerDownElement(e, el)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingId(el.id)
                }}
              >
                {editingId === el.id ? (
                  <textarea
                    autoFocus
                    value={el.text}
                    onChange={(e) => updateElement(el.id, { text: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <p>{el.text}</p>
                )}
                <span className="bubble-tail" aria-hidden />
                {selected && (
                  <div className="bubble-style-switch">
                    {(['speech', 'shout', 'thought'] as const).map((styleName) => (
                      <button
                        key={styleName}
                        type="button"
                        className={el.style === styleName ? 'active' : ''}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateElement(el.id, { style: styleName })
                        }}
                      >
                        {styleName[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // sfx
          return (
            <div
              key={el.id}
              className={`el sfx ${selected ? 'selected' : ''}`}
              style={{
                ...style,
                color: el.color,
                transform: `rotate(${el.rotation}deg)`,
              }}
              onPointerDown={(e) => onPointerDownElement(e, el)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingId(el.id)
              }}
            >
              {editingId === el.id ? (
                <input
                  autoFocus
                  value={el.text}
                  onChange={(e) => updateElement(el.id, { text: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{el.text}</span>
              )}
            </div>
          )
        })}

        {draftPanel && (
          <div
            className="el panel draft"
            style={{
              left: `${(draftPanel.x / CANVAS_WIDTH) * 100}%`,
              top: `${(draftPanel.y / CANVAS_HEIGHT) * 100}%`,
              width: `${(draftPanel.width / CANVAS_WIDTH) * 100}%`,
              height: `${(draftPanel.height / CANVAS_HEIGHT) * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
