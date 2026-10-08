import type { BubbleElement, CanvasElement, ImageElement, Page, PanelElement, SfxElement } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { imageDrawBox } from './frame'
import { loadImage } from './images'

const INK = '#101820'
const PAPER = '#fffdf7'

export async function renderPageCanvas(page: Page, scale = 2): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CANVAS_WIDTH * scale)
  canvas.height = Math.round(CANVAS_HEIGHT * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw that page.')

  context.fillStyle = PAPER
  context.fillRect(0, 0, canvas.width, canvas.height)

  const images = page.elements
    .filter((element): element is ImageElement => element.kind === 'image')
    .sort((a, b) => a.zIndex - b.zIndex)
  const loaded = new Map<string, HTMLImageElement>()
  await Promise.all(
    images.map(async (element) => {
      if (loaded.has(element.src)) return
      try {
        loaded.set(element.src, await loadImage(element.src))
      } catch {
        loaded.delete(element.src)
      }
    }),
  )

  const panels = page.elements.filter((element): element is PanelElement => element.kind === 'panel')
  for (const element of images) {
    const image = loaded.get(element.src)
    if (!image) continue
    const panel = element.panelId ? panels.find((item) => item.id === element.panelId) : undefined
    drawImageElement(context, element, image, scale, panel)
  }

  for (const element of page.elements) {
    if (element.kind === 'panel') drawPanel(context, element, scale)
  }

  const words = page.elements
    .filter((element): element is BubbleElement | SfxElement => element.kind === 'bubble' || element.kind === 'sfx')
    .sort((a, b) => a.zIndex - b.zIndex)
  for (const element of words) {
    if (element.kind === 'bubble') drawBubble(context, element, scale)
    else drawSfx(context, element, scale)
  }

  return canvas
}

function drawImageElement(
  context: CanvasRenderingContext2D,
  element: ImageElement,
  image: HTMLImageElement,
  scale: number,
  panel?: PanelElement,
) {
  const box = imageDrawBox(element, panel)
  context.save()
  if (panel) {
    context.beginPath()
    context.rect(panel.x * scale, panel.y * scale, panel.width * scale, panel.height * scale)
    context.clip()
  }
  context.translate((box.x + box.width / 2) * scale, (box.y + box.height / 2) * scale)
  context.rotate((element.rotation * Math.PI) / 180)
  context.scale(element.flipX ? -1 : 1, element.flipY ? -1 : 1)
  if (element.frame && panel) {
    context.drawImage(image, (-box.width / 2) * scale, (-box.height / 2) * scale, box.width * scale, box.height * scale)
  } else {
    const fitted = fitBox(image.width, image.height, box.width * scale, box.height * scale, element.role === 'scene' ? 'cover' : 'contain')
    context.drawImage(image, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height)
  }
  context.restore()
}

function fitBox(srcW: number, srcH: number, boxW: number, boxH: number, mode: 'cover' | 'contain') {
  const sourceRatio = srcW / Math.max(1, srcH)
  const boxRatio = boxW / Math.max(1, boxH)
  const cover = mode === 'cover'
  const widthLimited = cover ? sourceRatio < boxRatio : sourceRatio > boxRatio
  if (widthLimited) return { width: boxW, height: boxW / sourceRatio }
  return { width: boxH * sourceRatio, height: boxH }
}

function drawPanel(context: CanvasRenderingContext2D, element: CanvasElement, scale: number) {
  context.save()
  context.strokeStyle = INK
  context.lineWidth = 7 * scale
  context.strokeRect(
    element.x * scale + context.lineWidth / 2,
    element.y * scale + context.lineWidth / 2,
    Math.max(1, element.width * scale - context.lineWidth),
    Math.max(1, element.height * scale - context.lineWidth),
  )
  context.restore()
}

function drawBubble(context: CanvasRenderingContext2D, element: BubbleElement, scale: number) {
  const x = (element.x + element.width / 2) * scale
  const y = (element.y + element.height / 2) * scale
  const rx = (element.width / 2) * scale
  const ry = (element.height / 2) * scale
  context.save()
  context.translate(x, y)
  context.fillStyle = '#ffffff'
  context.strokeStyle = INK
  context.lineWidth = 4 * scale
  context.beginPath()
  if (element.style === 'shout') drawBurst(context, rx, ry)
  else context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  context.fill()
  if (element.style === 'thought') context.setLineDash([8 * scale, 6 * scale])
  context.stroke()
  context.setLineDash([])
  if (element.style === 'speech') {
    context.beginPath()
    context.moveTo(-rx * 0.2, ry * 0.72)
    context.lineTo(rx * 0.05, ry * 0.55)
    context.lineTo(-rx * 0.45, ry * 1.15)
    context.closePath()
    context.fill()
    context.stroke()
  }
  if (element.style === 'thought') {
    context.beginPath()
    context.arc(-rx * 0.35, ry * 0.95, 7 * scale, 0, Math.PI * 2)
    context.arc(-rx * 0.58, ry * 1.2, 4 * scale, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  drawWrappedText(context, element.text, element.width * scale * 0.72, element.height * scale * 0.62, 700)
  context.restore()
}

function drawBurst(context: CanvasRenderingContext2D, rx: number, ry: number) {
  const spikes = 14
  for (let index = 0; index < spikes; index += 1) {
    const angle = (index / spikes) * Math.PI * 2 - Math.PI / 2
    const radius = index % 2 === 0 ? 1 : 0.78
    const px = Math.cos(angle) * rx * radius
    const py = Math.sin(angle) * ry * radius
    if (index === 0) context.moveTo(px, py)
    else context.lineTo(px, py)
  }
  context.closePath()
}

function drawSfx(context: CanvasRenderingContext2D, element: SfxElement, scale: number) {
  context.save()
  context.translate((element.x + element.width / 2) * scale, (element.y + element.height / 2) * scale)
  context.rotate((element.rotation * Math.PI) / 180)
  context.fillStyle = element.color
  context.strokeStyle = '#ffffff'
  context.lineWidth = 6 * scale
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  let size = element.height * scale * 0.62
  const font = (next: number) => `400 ${next}px Bangers, Impact, sans-serif`
  context.font = font(size)
  while (context.measureText(element.text).width > element.width * scale * 0.92 && size > 12) {
    size *= 0.9
    context.font = font(size)
  }
  context.strokeText(element.text, 0, 0)
  context.fillText(element.text, 0, 0)
  context.restore()
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  weight: number,
) {
  let size = Math.max(16, Math.min(42, maxHeight / 3.2))
  const font = (next: number) => `${weight} ${next}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`
  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = font(size)
  let lines = wrapLines(context, text, maxWidth)
  while (lines.length * size * 1.2 > maxHeight && size > 12) {
    size -= 2
    context.font = font(size)
    lines = wrapLines(context, text, maxWidth)
  }
  const lineHeight = size * 1.2
  const start = -((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    context.fillText(line, 0, start + index * lineHeight)
  })
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}
