import type { PanelElement, Rect } from '../types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function findPanelAt(panels: PanelElement[], x: number, y: number): PanelElement | undefined {
  return [...panels].reverse().find((panel) => containsPoint(panel, x, y))
}

export function insetRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x + pad,
    y: rect.y + pad,
    width: Math.max(24, rect.width - pad * 2),
    height: Math.max(24, rect.height - pad * 2),
  }
}

export function clampRectInside(box: Rect, bounds: Rect, pad = 6): Rect {
  const width = Math.min(box.width, Math.max(24, bounds.width - pad * 2))
  const height = Math.min(box.height, Math.max(24, bounds.height - pad * 2))
  return {
    width,
    height,
    x: clamp(box.x, bounds.x + pad, bounds.x + bounds.width - width - pad),
    y: clamp(box.y, bounds.y + pad, bounds.y + bounds.height - height - pad),
  }
}
