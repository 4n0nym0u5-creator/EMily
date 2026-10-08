import { newId } from './ids'
import { clampRectInside, findPanelAt, insetRect } from './geometry'
import { LAYOUTS } from './layouts'
import type {
  BubbleElement,
  CanvasElement,
  ImageElement,
  ImageRole,
  Page,
  PanelElement,
  SfxElement,
  Story,
} from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'

export function nextZ(elements: CanvasElement[]): number {
  return elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1
}

export function panelsOf(elements: CanvasElement[]): PanelElement[] {
  return elements.filter((element): element is PanelElement => element.kind === 'panel')
}

export function largestPanel(elements: CanvasElement[]): PanelElement | null {
  const panels = panelsOf(elements)
  if (!panels.length) return null
  return panels.reduce((best, panel) =>
    panel.width * panel.height > best.width * best.height ? panel : best,
  )
}

export function updateElement(
  elements: CanvasElement[],
  id: string,
  patch: Partial<CanvasElement>,
): CanvasElement[] {
  return elements.map((element) =>
    element.id === id ? ({ ...element, ...patch } as CanvasElement) : element,
  )
}

export function removeElement(elements: CanvasElement[], id: string): CanvasElement[] {
  return elements.filter((element) => element.id !== id)
}

export function replacePageElements(story: Story, pageIndex: number, elements: CanvasElement[]): Story {
  return {
    ...story,
    pages: story.pages.map((page, index) =>
      index === pageIndex ? { ...page, elements, updatedAt: Date.now() } : page,
    ),
  }
}

export function createBubble(
  x: number,
  y: number,
  style: BubbleElement['style'],
  zIndex: number,
): BubbleElement {
  const width = style === 'thought' ? 180 : 200
  const height = style === 'shout' ? 120 : 108
  const text =
    style === 'thought' ? 'Hmm…' : style === 'shout' ? 'YEAH!' : "I've got this!"
  return {
    id: newId(),
    kind: 'bubble',
    text,
    style,
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
    zIndex,
  }
}

export function createSfx(x: number, y: number, text: string, zIndex: number): SfxElement {
  const width = Math.min(220, 56 + text.length * 28)
  const height = 72
  return {
    id: newId(),
    kind: 'sfx',
    text,
    color: '#ff5a1f',
    rotation: -8,
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
    zIndex,
  }
}

export function createPanel(rect: { x: number; y: number; width: number; height: number }): PanelElement {
  return {
    id: newId(),
    kind: 'panel',
    ...rect,
    zIndex: 1,
  }
}

export function applyLayout(elements: CanvasElement[], layoutId: string): CanvasElement[] {
  const layout = LAYOUTS.find((item) => item.id === layoutId)
  if (!layout) return elements
  const kept = elements.filter((element) => element.kind !== 'panel')
  const panels = layout.rects.map((rect) => createPanel(rect))
  return [...panels, ...kept]
}

function lowestImageZ(elements: CanvasElement[]): number {
  const images = elements.filter((element) => element.kind === 'image')
  if (!images.length) return 1
  return Math.min(...images.map((element) => element.zIndex))
}

export function placeAsset(
  elements: CanvasElement[],
  input: {
    src: string
    role: ImageRole
    aspect?: number
    point?: { x: number; y: number } | null
    panelId?: string | null
    characterId?: string
    poseId?: string
  },
): ImageElement {
  const panels = panelsOf(elements)
  const point = input.point ?? null
  const preferred = input.panelId ? panels.find((panel) => panel.id === input.panelId) : undefined
  const hit = point ? findPanelAt(panels, point.x, point.y) : undefined
  const panel = point ? hit : preferred ?? largestPanel(elements) ?? undefined
  const aspect = input.aspect && input.aspect > 0 ? input.aspect : 0.75

  if (input.role === 'scene') {
    const target = panel ?? (panels[0] ? largestPanel(elements) : null)
    const box = target
      ? insetRect(target, 8)
      : insetRect({ x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, 28)
    return {
      id: newId(),
      kind: 'image',
      src: input.src,
      ...box,
      panelId: target?.id ?? null,
      zIndex: lowestImageZ(elements) - 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      role: 'scene',
    }
  }

  const baseHeight = panel ? panel.height * 0.86 : CANVAS_HEIGHT * 0.34
  let height = baseHeight
  let width = height * aspect
  if (panel && width > panel.width * 0.9) {
    width = panel.width * 0.9
    height = width / aspect
  }
  if (!panel && width > CANVAS_WIDTH * 0.7) {
    width = CANVAS_WIDTH * 0.7
    height = width / aspect
  }

  const anchorX = point?.x ?? (panel ? panel.x + panel.width / 2 : CANVAS_WIDTH / 2)
  const anchorY = point?.y ?? (panel ? panel.y + panel.height * 0.62 : CANVAS_HEIGHT / 2)
  let box = {
    x: anchorX - width / 2,
    y: anchorY - height / 2,
    width,
    height,
  }
  if (panel) box = clampRectInside(box, panel, 8)
  else {
    box = clampRectInside(box, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, 8)
  }

  const stagger = point ? 0 : (elements.filter((element) => element.kind === 'image').length % 4) * 16

  return {
    id: newId(),
    kind: 'image',
    src: input.src,
    x: box.x + stagger,
    y: box.y + stagger,
    width: box.width,
    height: box.height,
    panelId: panel?.id ?? null,
    zIndex: nextZ(elements),
    rotation: 0,
    flipX: false,
    flipY: false,
    role: input.role,
    characterId: input.characterId,
    poseId: input.poseId,
  }
}

export function scaleElement(element: CanvasElement, factor: number): CanvasElement {
  const width = Math.min(CANVAS_WIDTH * 1.4, Math.max(48, element.width * factor))
  const height = Math.min(CANVAS_HEIGHT * 1.4, Math.max(48, element.height * factor))
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  return { ...element, width, height, x: cx - width / 2, y: cy - height / 2 }
}

export function rotateElement(element: CanvasElement, delta: number): CanvasElement {
  if (element.kind !== 'image' && element.kind !== 'sfx') return element
  const rotation = (((element.rotation + delta) % 360) + 360) % 360
  return { ...element, rotation }
}

export function flipElement(element: CanvasElement, axis: 'x' | 'y'): CanvasElement {
  if (element.kind !== 'image') return element
  return axis === 'x' ? { ...element, flipX: !element.flipX } : { ...element, flipY: !element.flipY }
}

export function duplicateElement(elements: CanvasElement[], id: string): CanvasElement[] {
  const element = elements.find((item) => item.id === id)
  if (!element) return elements
  const copy = {
    ...element,
    id: newId(),
    x: element.x + 28,
    y: element.y + 28,
    zIndex: nextZ(elements),
  } as CanvasElement
  return [...elements, copy]
}

export function changeLayer(
  elements: CanvasElement[],
  id: string,
  direction: 'forward' | 'backward',
): CanvasElement[] {
  const target = elements.find((element) => element.id === id)
  if (!target || target.kind === 'panel') return elements
  const groupOf = (element: CanvasElement) =>
    element.kind === 'bubble' || element.kind === 'sfx' ? 'text' : element.kind
  const peers = elements
    .filter((element) => groupOf(element) === groupOf(target))
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
  const index = peers.findIndex((element) => element.id === id)
  const nextIndex = direction === 'forward' ? index + 1 : index - 1
  if (index < 0 || nextIndex < 0 || nextIndex >= peers.length) return elements
  const reordered = [...peers]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(nextIndex, 0, moved)
  const zOf = new Map(reordered.map((element, peerIndex) => [element.id, peerIndex + 1]))
  return elements.map((element) =>
    zOf.has(element.id) ? { ...element, zIndex: zOf.get(element.id) ?? element.zIndex } : element,
  )
}

export function fitImageToPanel(element: ImageElement, panel: PanelElement): ImageElement {
  const box = insetRect(panel, 8)
  if (element.role === 'scene') {
    return { ...element, ...box, panelId: panel.id }
  }
  const aspect = element.width / Math.max(1, element.height)
  let height = box.height * 0.92
  let width = height * aspect
  if (width > box.width) {
    width = box.width
    height = width / aspect
  }
  return {
    ...element,
    width,
    height,
    x: box.x + (box.width - width) / 2,
    y: box.y + box.height - height,
    panelId: panel.id,
  }
}

export function pageTitle(page: Page, index: number): string {
  return page.title.trim() || `Page ${index + 1}`
}
