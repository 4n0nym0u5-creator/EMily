import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { BubbleElement, CanvasElement, ImageElement, PanelElement, SfxElement } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { imageDrawBox } from '../lib/frame'

interface PageFrameProps {
  elements: CanvasElement[]
  selectedId?: string | null
  editingId?: string | null
  interactive?: boolean
  draftPanel?: { x: number; y: number; width: number; height: number } | null
  onElementPointerDown?: (event: ReactPointerEvent, element: CanvasElement) => void
  onElementPointerUp?: (event: ReactPointerEvent, element: CanvasElement) => void
  onTextChange?: (id: string, text: string) => void
  onEditBlur?: () => void
  onResizePointerDown?: (event: ReactPointerEvent, element: CanvasElement) => void
}

export function PageFrame({
  elements,
  selectedId = null,
  editingId = null,
  interactive = false,
  draftPanel = null,
  onElementPointerDown,
  onElementPointerUp,
  onTextChange,
  onEditBlur,
  onResizePointerDown,
}: PageFrameProps) {
  const images = elements
    .filter((element): element is ImageElement => element.kind === 'image')
    .sort((a, b) => a.zIndex - b.zIndex)
  const panels = elements.filter((element): element is PanelElement => element.kind === 'panel')
  const words = elements
    .filter((element): element is BubbleElement | SfxElement => element.kind === 'bubble' || element.kind === 'sfx')
    .sort((a, b) => a.zIndex - b.zIndex)

  const framed = panels
    .map((panel) => ({ panel, images: images.filter((image) => image.panelId === panel.id) }))
    .filter((group) => group.images.length > 0)
  const loose = images.filter((image) => !panels.some((panel) => panel.id === image.panelId))

  return (
    <>
      {framed.map(({ panel, images: group }) => (
        <div key={panel.id} className="panel-clip" style={boxStyle(panel, Math.max(...group.map((image) => image.zIndex)))}>
          {group.map((element) => (
            <ImageEl
              key={element.id}
              element={element}
              panel={panel}
              selected={element.id === selectedId}
              interactive={interactive}
              onElementPointerDown={onElementPointerDown}
              onElementPointerUp={onElementPointerUp}
              onResizePointerDown={onResizePointerDown}
            />
          ))}
          {interactive && selectedId && group.some((image) => image.id === selectedId) && (
            <button
              type="button"
              className="resize-handle"
              aria-label="Resize picture in frame"
              onPointerDown={(event) => {
                const image = group.find((item) => item.id === selectedId)
                if (image) onResizePointerDown?.(event, image)
              }}
            />
          )}
        </div>
      ))}
      {loose.map((element) => (
        <ImageEl
          key={element.id}
          element={element}
          selected={element.id === selectedId}
          interactive={interactive}
          onElementPointerDown={onElementPointerDown}
          onElementPointerUp={onElementPointerUp}
          onResizePointerDown={onResizePointerDown}
        />
      ))}

      {panels.map((element, index) => {
        const selected = element.id === selectedId
        return (
          <div key={element.id} className={`el panel ${selected ? 'selected' : ''}`} style={boxStyle(element, 50)}>
            {interactive && (
              <button
                type="button"
                className="panel-tab"
                aria-label={`Select panel ${index + 1}`}
                onPointerDown={(event) => onElementPointerDown?.(event, element)}
                onPointerUp={(event) => onElementPointerUp?.(event, element)}
              >
                {index + 1}
              </button>
            )}
            {interactive && selected && (
              <button
                type="button"
                className="resize-handle"
                aria-label="Resize panel"
                onPointerDown={(event) => onResizePointerDown?.(event, element)}
              />
            )}
          </div>
        )
      })}

      {words.map((element) => {
        const selected = element.id === selectedId
        if (element.kind === 'bubble') {
          return (
            <div
              key={element.id}
              className={`el bubble style-${element.style} ${selected ? 'selected' : ''} ${interactive ? '' : 'readonly'}`}
              style={boxStyle(element, 80 + element.zIndex)}
              onPointerDown={interactive ? (event) => onElementPointerDown?.(event, element) : undefined}
              onPointerUp={interactive ? (event) => onElementPointerUp?.(event, element) : undefined}
            >
              {interactive && editingId === element.id ? (
                <textarea
                  autoFocus
                  value={element.text}
                  aria-label="Bubble text"
                  onChange={(event) => onTextChange?.(element.id, event.target.value)}
                  onBlur={() => onEditBlur?.()}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              ) : (
                <p>{element.text}</p>
              )}
              {element.style === 'speech' && <span className="bubble-tail" aria-hidden="true" />}
              {element.style === 'thought' && (
                <>
                  <span className="thought-dot thought-dot-a" aria-hidden="true" />
                  <span className="thought-dot thought-dot-b" aria-hidden="true" />
                </>
              )}
              {interactive && selected && (
                <button
                  type="button"
                  className="resize-handle"
                  aria-label="Resize bubble"
                  onPointerDown={(event) => onResizePointerDown?.(event, element)}
                />
              )}
            </div>
          )
        }
        return (
          <div
            key={element.id}
            className={`el sfx ${selected ? 'selected' : ''} ${interactive ? '' : 'readonly'}`}
            style={{
              ...boxStyle(element, 80 + element.zIndex),
              color: element.color,
              transform: `rotate(${element.rotation}deg)`,
            }}
            onPointerDown={interactive ? (event) => onElementPointerDown?.(event, element) : undefined}
            onPointerUp={interactive ? (event) => onElementPointerUp?.(event, element) : undefined}
          >
            {interactive && editingId === element.id ? (
              <input
                autoFocus
                value={element.text}
                aria-label="Sound effect text"
                onChange={(event) => onTextChange?.(element.id, event.target.value)}
                onBlur={() => onEditBlur?.()}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : (
              <span>{element.text}</span>
            )}
            {interactive && selected && (
              <button
                type="button"
                className="resize-handle"
                aria-label="Resize sound effect"
                onPointerDown={(event) => onResizePointerDown?.(event, element)}
              />
            )}
          </div>
        )
      })}

      {draftPanel && <div className="el panel draft" style={boxStyle({ ...draftPanel, zIndex: 60 }, 60)} />}
    </>
  )
}

function ImageEl({
  element,
  panel,
  selected,
  interactive,
  onElementPointerDown,
  onElementPointerUp,
  onResizePointerDown,
}: {
  element: ImageElement
  panel?: PanelElement
  selected: boolean
  interactive: boolean
  onElementPointerDown?: (event: ReactPointerEvent, element: CanvasElement) => void
  onElementPointerUp?: (event: ReactPointerEvent, element: CanvasElement) => void
  onResizePointerDown?: (event: ReactPointerEvent, element: CanvasElement) => void
}) {
  const box = imageDrawBox(element, panel)
  const style: CSSProperties = panel
    ? {
        left: `${((box.x - panel.x) / panel.width) * 100}%`,
        top: `${((box.y - panel.y) / panel.height) * 100}%`,
        width: `${(box.width / panel.width) * 100}%`,
        height: `${(box.height / panel.height) * 100}%`,
        zIndex: element.zIndex,
      }
    : boxStyle(element, element.zIndex)
  return (
    <div
      className={`el image ${selected ? 'selected' : ''}`}
      style={style}
      onPointerDown={interactive ? (event) => onElementPointerDown?.(event, element) : undefined}
      onPointerUp={interactive ? (event) => onElementPointerUp?.(event, element) : undefined}
    >
      <img
        src={element.src}
        alt=""
        draggable={false}
        style={{
          objectFit: element.frame ? 'fill' : element.role === 'scene' ? 'cover' : 'contain',
          transform: `scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1}) rotate(${element.rotation}deg)`,
        }}
      />
      {interactive && selected && !panel && (
        <button
          type="button"
          className="resize-handle"
          aria-label="Resize"
          onPointerDown={(event) => onResizePointerDown?.(event, element)}
        />
      )}
    </div>
  )
}

function boxStyle(element: { x: number; y: number; width: number; height: number; zIndex: number }, z: number): CSSProperties {
  return {
    left: `${(element.x / CANVAS_WIDTH) * 100}%`,
    top: `${(element.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(element.width / CANVAS_WIDTH) * 100}%`,
    height: `${(element.height / CANVAS_HEIGHT) * 100}%`,
    zIndex: z,
  }
}
