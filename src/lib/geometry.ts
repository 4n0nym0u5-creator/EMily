import type { PanelElement, Rect } from '../types'

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rect {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return {
    x,
    y,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function findPanelAt(
  panels: PanelElement[],
  x: number,
  y: number,
): PanelElement | undefined {
  return [...panels].reverse().find((p) => containsPoint(p, x, y))
}

export function snapImageToPanel(panel: PanelElement): Rect {
  return {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
  }
}
