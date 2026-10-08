import { loadImage } from './images'
import type { MangaFilterId } from '../types'

export interface LookResult {
  url: string
  cutout: 'off' | 'applied' | 'skipped'
}

const cache = new Map<string, LookResult>()

function cacheGet(key: string): LookResult | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

function cacheSet(key: string, value: LookResult) {
  cache.set(key, value)
  if (cache.size > 16) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

export async function applyLook(
  src: string,
  options: { filter: MangaFilterId; cutout: boolean; maxEdge?: number },
): Promise<LookResult> {
  if (options.filter === 'original' && !options.cutout) {
    return { url: src, cutout: 'off' }
  }

  const maxEdge = options.maxEdge ?? 1200
  const key = `${options.filter}|${options.cutout}|${maxEdge}|${quickHash(src)}`
  const cached = cacheGet(key)
  if (cached) return cached

  const image = await loadImage(src)
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height, 1))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Could not prepare that picture.')
  context.drawImage(image, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const pixels = imageData.data

  let cutout: LookResult['cutout'] = options.cutout ? 'applied' : 'off'
  if (options.cutout) {
    const mask = buildCutoutMask(pixels, width, height)
    if (!mask) cutout = 'skipped'
    else applyMask(pixels, mask, width, height)
  }

  if (options.filter === 'grey') applyGrey(pixels)
  else if (options.filter === 'contrast') applyContrast(pixels)
  else if (options.filter === 'ink') applyInk(pixels, width, height)
  else if (options.filter === 'screentone') applyScreentone(pixels, width, height)

  context.putImageData(imageData, 0, 0)
  const url =
    cutout === 'applied' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
  const result = { url, cutout }
  cacheSet(key, result)
  return result
}

function buildCutoutMask(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array | null {
  const samples: Array<[number, number, number, number]> = []
  const step = Math.max(1, Math.floor(Math.max(width, height) / 48))
  for (let x = 0; x < width; x += step) {
    samples.push(readPixel(pixels, x, 0, width))
    samples.push(readPixel(pixels, x, height - 1, width))
  }
  for (let y = 0; y < height; y += step) {
    samples.push(readPixel(pixels, 0, y, width))
    samples.push(readPixel(pixels, width - 1, y, width))
  }
  if (!samples.length) return null

  const transparent = samples.filter((sample) => sample[3] < 30).length
  if (transparent / samples.length > 0.55) return null

  const background = medianColor(samples)
  let total = 0
  for (const sample of samples) total += distance(sample, background)
  const mean = total / samples.length
  const threshold = mean < 26 ? 48 : mean < 46 ? 34 : 24

  const mask = new Uint8Array(width * height)
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = y * width + x
    if (seen[index]) return
    seen[index] = 1
    const color = readPixel(pixels, x, y, width)
    if (distance(color, background) <= threshold) {
      mask[index] = 1
      stack.push(index)
    }
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (stack.length) {
    const index = stack.pop() as number
    const x = index % width
    const y = Math.floor(index / width)
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  let removed = 0
  for (let index = 0; index < mask.length; index++) removed += mask[index]
  const ratio = removed / mask.length
  if (ratio < 0.03 || ratio > 0.9) return null
  return mask
}

function applyMask(pixels: Uint8ClampedArray, mask: Uint8Array, width: number, height: number) {
  const alpha = new Uint8ClampedArray(mask.length)
  for (let index = 0; index < mask.length; index++) {
    alpha[index] = mask[index] ? 0 : pixels[index * 4 + 3]
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (mask[index]) continue
      let near = 0
      if (mask[index - 1]) near += 1
      if (mask[index + 1]) near += 1
      if (mask[index - width]) near += 1
      if (mask[index + width]) near += 1
      if (near) alpha[index] = Math.round(alpha[index] * (1 - near * 0.18))
    }
  }
  for (let index = 0; index < mask.length; index++) pixels[index * 4 + 3] = alpha[index]
}

function applyGrey(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 8) continue
    const tone = luminance(pixels[index], pixels[index + 1], pixels[index + 2])
    pixels[index] = pixels[index + 1] = pixels[index + 2] = tone
  }
}

function applyContrast(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 8) continue
    for (let channel = 0; channel < 3; channel++) {
      let value = (pixels[index + channel] - 128) * 1.75 + 128
      value = Math.max(0, Math.min(255, value))
      value = Math.round(value / 255 * 5) / 5 * 255
      pixels[index + channel] = value
    }
  }
}

function applyInk(pixels: Uint8ClampedArray, width: number, height: number) {
  const source = new Uint8ClampedArray(pixels)
  const tones = new Float32Array(width * height)
  for (let index = 0; index < tones.length; index++) {
    const offset = index * 4
    tones[index] = luminance(source[offset], source[offset + 1], source[offset + 2])
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const offset = index * 4
      if (source[offset + 3] < 8) {
        pixels[offset + 3] = 0
        continue
      }
      const magnitude = edgeMagnitude(tones, x, y, width, height)
      let tone = (tones[index] - 128) * 1.35 + 128
      tone = Math.max(0, Math.min(255, tone))
      tone = Math.round((tone / 255) * 3) * (255 / 3)
      if (magnitude > 72) tone = 0
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = tone
      pixels[offset + 3] = source[offset + 3]
    }
  }
}

function applyScreentone(pixels: Uint8ClampedArray, width: number, height: number) {
  const source = new Uint8ClampedArray(pixels)
  const tones = new Float32Array(width * height)
  for (let index = 0; index < tones.length; index++) {
    const offset = index * 4
    tones[index] = luminance(source[offset], source[offset + 1], source[offset + 2])
  }
  const cell = 5
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const offset = index * 4
      if (source[offset + 3] < 8) {
        pixels[offset + 3] = 0
        continue
      }
      const magnitude = edgeMagnitude(tones, x, y, width, height)
      const darkness = 1 - Math.max(0, Math.min(255, tones[index])) / 255
      const localX = (x % cell) - cell / 2
      const localY = (y % cell) - cell / 2
      const inked = magnitude > 78 || Math.hypot(localX, localY) < darkness * cell * 0.75
      const tone = inked ? 20 : 248
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = tone
      pixels[offset + 3] = source[offset + 3]
    }
  }
}

function edgeMagnitude(tones: Float32Array, x: number, y: number, width: number, height: number) {
  const gx = sampleTone(tones, x + 1, y, width, height) - sampleTone(tones, x - 1, y, width, height)
  const gy = sampleTone(tones, x, y + 1, width, height) - sampleTone(tones, x, y - 1, width, height)
  return Math.hypot(gx, gy)
}

function sampleTone(tones: Float32Array, x: number, y: number, width: number, height: number) {
  const sx = Math.max(0, Math.min(width - 1, x))
  const sy = Math.max(0, Math.min(height - 1, y))
  return tones[sy * width + sx]
}

function quickHash(value: string): string {
  let hash = 2166136261
  const step = Math.max(1, Math.floor(value.length / 80))
  for (let index = 0; index < value.length; index += step) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function luminance(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function readPixel(pixels: Uint8ClampedArray, x: number, y: number, width: number): [number, number, number, number] {
  const offset = (y * width + x) * 4
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]
}

function medianColor(samples: Array<[number, number, number, number]>): [number, number, number] {
  const channel = (index: 0 | 1 | 2) => {
    const values = samples.map((sample) => sample[index]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)] ?? 255
  }
  return [channel(0), channel(1), channel(2)]
}

function distance(sample: [number, number, number, number], background: [number, number, number]) {
  const dr = sample[0] - background[0]
  const dg = sample[1] - background[1]
  const db = sample[2] - background[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
