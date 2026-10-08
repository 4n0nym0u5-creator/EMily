import type { FrameView, ImageElement, PanelElement } from '../types'
import { clamp } from './geometry'

export const FRAME_SCALE_MIN = 0.4
export const FRAME_SCALE_MAX = 4

export function imageAspect(element: ImageElement): number {
  if (element.aspect && element.aspect > 0) return element.aspect
  return element.width / Math.max(1, element.height)
}

export function defaultFrame(element: ImageElement): FrameView {
  return { fit: element.role === 'scene' ? 'cover' : 'contain', scale: 1, x: 0, y: 0 }
}

export function frameFromRect(element: ImageElement, panel: PanelElement): FrameView {
  const fit: FrameView['fit'] = element.role === 'scene' ? 'cover' : 'contain'
  const base = fittedSize(panel, imageAspect(element), fit, 1)
  return {
    fit,
    scale: clamp(element.width / Math.max(1, base.width), FRAME_SCALE_MIN, FRAME_SCALE_MAX),
    x: element.x + element.width / 2 - (panel.x + panel.width / 2),
    y: element.y + element.height / 2 - (panel.y + panel.height / 2),
  }
}

export function fittedSize(panel: PanelElement, aspect: number, fit: FrameView['fit'], scale: number) {
  const safeAspect = aspect > 0 ? aspect : 1
  const panelAspect = panel.width / Math.max(1, panel.height)
  const widthLimited = fit === 'cover' ? safeAspect < panelAspect : safeAspect > panelAspect
  if (widthLimited) {
    const width = panel.width * scale
    return { width, height: width / safeAspect }
  }
  const height = panel.height * scale
  return { width: height * safeAspect, height }
}

export function frameBox(panel: PanelElement, aspect: number, frame: FrameView) {
  const size = fittedSize(panel, aspect, frame.fit, frame.scale)
  const cx = panel.x + panel.width / 2 + frame.x
  const cy = panel.y + panel.height / 2 + frame.y
  return { x: cx - size.width / 2, y: cy - size.height / 2, width: size.width, height: size.height }
}

export function imageDrawBox(element: ImageElement, panel: PanelElement | undefined) {
  if (!panel || !element.frame) {
    return { x: element.x, y: element.y, width: element.width, height: element.height }
  }
  return frameBox(panel, imageAspect(element), element.frame)
}

export function withFrame(element: ImageElement, panel: PanelElement, frame: FrameView): ImageElement {
  const next: FrameView = { ...frame, scale: clamp(frame.scale, FRAME_SCALE_MIN, FRAME_SCALE_MAX) }
  return { ...element, panelId: panel.id, frame: next, aspect: imageAspect(element), ...frameBox(panel, imageAspect(element), next) }
}
