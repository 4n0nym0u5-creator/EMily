import { newId } from './ids'
import type { CanvasElement, ImageElement, PanelElement } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { snapImageToPanel } from './geometry'

function nextZ(elements: CanvasElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1
}

export function createImageElement(
  elements: CanvasElement[],
  src: string,
  role: ImageElement['role'] = 'upload',
  targetPanel?: PanelElement | null,
): ImageElement {
  if (targetPanel) {
    return {
      id: newId(),
      kind: 'image',
      src,
      ...snapImageToPanel(targetPanel),
      panelId: targetPanel.id,
      zIndex: nextZ(elements),
      role,
    }
  }

  const isScene = role === 'scene'
  const width = isScene ? CANVAS_WIDTH * 0.92 : CANVAS_WIDTH * 0.42
  const height = isScene ? CANVAS_HEIGHT * 0.55 : CANVAS_HEIGHT * 0.38

  return {
    id: newId(),
    kind: 'image',
    src,
    x: (CANVAS_WIDTH - width) / 2,
    y: isScene ? CANVAS_HEIGHT * 0.08 : (CANVAS_HEIGHT - height) / 2,
    width,
    height,
    panelId: null,
    zIndex: isScene ? 1 : nextZ(elements),
    role,
  }
}
