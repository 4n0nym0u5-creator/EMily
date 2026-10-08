// Shared by the Vite dev server and the Cloudflare Worker.
// Web fetch only: no Buffer, no Node crypto, no process.env.

export const DIFFERENT_IDEA =
  "Let's try a different idea. That drawing was not kept. Try another expression, or a simpler note like a volleyball jersey."

export const PASSCODE_HEADER = 'x-emily-passcode'

const DEFAULT_BASE = 'https://api.venice.ai/api/v1'
const DEFAULT_IMAGE_MODEL = 'wai-Illustrious'
const DEFAULT_EDIT_MODEL = 'firered-image-edit'
const FIRE_RED_PROMPT_LIMIT = 1500
const MIN_PIXELS = 65_536
const MAX_BODY = 12 * 1024 * 1024
const WINDOW_MS = 10 * 60 * 1000
const WINDOW_MAX = 8
const DAY_MAX = 40

const ALLOWED_ORIGINS = new Set([
  'https://4n0nym0u5-creator.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const EDIT_ASPECTS = ['auto', '1:1', '3:2', '16:9', '21:9', '9:16', '2:3', '3:4', '4:3', '4:5'] as const
export type VeniceAspect = (typeof EDIT_ASPECTS)[number]

const STYLES: Record<string, string> = {
  haikyuu:
    'Japanese shonen sports anime in the spirit of Haikyuu!!, clean cel shading, expressive eyes, athletic energy, warm lighting',
  shojo: 'soft shojo manga, delicate linework, gentle sparkles, pastel light, large expressive eyes',
  chibi: 'cute chibi manga, big head, small body, simple bold shapes, friendly and clear',
  ink: 'black and white manga ink, crisp lineart, screentone shading, no color',
  action: 'dynamic sports manga, speed lines, bold ink, high energy motion',
}

const EXPRESSIONS: Record<string, string> = {
  smile: 'a warm genuine smile',
  determined: 'a determined, fiery expression',
  surprised: 'a surprised expression',
  shy: 'a shy, slightly blushing expression',
  shout: 'shouting with energy, mouth open',
  calm: 'a calm, confident expression',
}

const POSES: Record<string, string> = {
  portrait: 'bust portrait, facing slightly toward the camera',
  stand: 'full body, standing proud with hands on hips',
  spike: 'full body mid-air volleyball spike',
  receive: 'full body, knees bent, ready to receive a volleyball',
  cheer: 'full body, celebrating with a fist pump',
  run: 'full body, running forward',
}

const ALL_AGES = 'Fully clothed, wholesome, all-ages manga. No scary, violent, or adult content.'

export interface VeniceSettings {
  apiKey: string
  baseUrl: string
  imageModel: string
  editModel: string
  safeMode: boolean
}

export interface EmilyAiEnv {
  VENICE_API_KEY?: string
  VENICE_BASE_URL?: string
  VENICE_IMAGE_MODEL?: string
  VENICE_EDIT_MODEL?: string
  VENICE_SAFE_MODE?: string
  EMILY_MOCK_AI?: string
  EMILY_PASSCODE?: string
  /** Worker always sets this. Local dev sets it only when EMILY_PASSCODE is present. */
  requirePasscode?: boolean
}

export interface EmilyDailyStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export interface EmilyLimits {
  daily?: EmilyDailyStore
}

type JsonBody = {
  referenceDataUrl?: string
  imageDataUrl?: string
  prompt?: string
  style?: string
  expression?: string
  pose?: string
  note?: string
  transparent?: boolean
}

interface RateBucket {
  reset: number
  count: number
  day: string
  dayCount: number
}

const buckets = new Map<string, RateBucket>()

export function resetEmilyLimitsForTests() {
  buckets.clear()
}

/** Unset means off. */
export function parseSafeMode(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes'
}

export function veniceFlagged(headers: { get(name: string): string | null }, safeMode: boolean): boolean {
  if (headers.get('x-venice-is-content-violation') === 'true') return true
  return safeMode && headers.get('x-venice-is-blurred') === 'true'
}

function settingsFrom(env: EmilyAiEnv): VeniceSettings {
  const apiKey = env.VENICE_API_KEY?.trim() ?? ''
  if (!apiKey) throw new Error('AI drawing is not turned on yet.')
  return {
    apiKey,
    baseUrl: env.VENICE_BASE_URL?.trim() || DEFAULT_BASE,
    imageModel: env.VENICE_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
    editModel: env.VENICE_EDIT_MODEL?.trim() || DEFAULT_EDIT_MODEL,
    safeMode: parseSafeMode(env.VENICE_SAFE_MODE),
  }
}

async function discardAndRejectIfFlagged(response: Response, safeMode: boolean) {
  if (!veniceFlagged(response.headers, safeMode)) return
  await response.arrayBuffer().catch(() => undefined)
  throw new Error(DIFFERENT_IDEA)
}

async function veniceFailure(response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) return new Error('AI drawing is not turned on yet.')
  return new Error('The drawing did not work. You can try again.')
}

export async function generateVeniceImage(settings: VeniceSettings, prompt: string, width = 1024, height = 1024): Promise<string> {
  const response = await fetch(`${settings.baseUrl}/image/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.imageModel,
      prompt,
      negative_prompt: 'nudity, violence, gore, scary, text, watermark, photograph',
      width,
      height,
      safe_mode: settings.safeMode,
      format: 'png',
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, settings.safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const data = (await response.json()) as { images?: string[] }
  const image = data.images?.[0]
  if (!image) throw new Error('The drawing did not come back. You can try again.')
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`
}

export async function editVeniceImage(
  settings: VeniceSettings,
  prompt: string,
  imageBase64: string,
  aspectRatio: VeniceAspect = '1:1',
): Promise<string> {
  const response = await fetch(`${settings.baseUrl}/image/edit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.editModel,
      prompt: prompt.slice(0, FIRE_RED_PROMPT_LIMIT),
      image: imageBase64.replace(/\s/g, ''),
      safe_mode: settings.safeMode,
      output_format: 'png',
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, settings.safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) throw new Error('The drawing did not come back. You can try again.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 32) throw new Error('The drawing did not come back. You can try again.')
  const mime = type.split(';')[0] || 'image/png'
  return `data:${mime};base64,${encodeBase64(bytes)}`
}

export async function removeVeniceBackground(settings: VeniceSettings, imageBase64: string): Promise<string> {
  const response = await fetch(`${settings.baseUrl}/image/background-remove`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64.replace(/\s/g, ''),
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, settings.safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const type = response.headers.get('content-type') ?? ''
  const bytes = new Uint8Array(await response.arrayBuffer())
  const png = bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG'
  if (!type.startsWith('image/') && !png) throw new Error('The see-through step did not come back. You can try again.')
  if (bytes.length < 32) throw new Error('The see-through step did not come back. You can try again.')
  return `data:image/png;base64,${encodeBase64(bytes)}`
}

function pick(map: Record<string, string>, id: string | undefined, fallback: string) {
  if (id && map[id]) return map[id]
  return map[fallback] ?? fallback
}

function cleanNote(note: string | undefined) {
  if (!note) return ''
  return note.replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function characterPrompt(body: JsonBody) {
  const style = pick(STYLES, body.style, 'haikyuu')
  const expression = pick(EXPRESSIONS, body.expression, 'smile')
  const pose = pick(POSES, body.pose, 'portrait')
  const note = cleanNote(body.note)
  const seeThrough = body.transparent !== false
  return [
    'Redraw this person as a manga character.',
    'Keep the same face shape, hair color, hair style, skin tone, age, and distinctive features.',
    ALL_AGES,
    `Style: ${style}.`,
    `Expression: ${expression}.`,
    `Pose: ${pose}.`,
    note ? `Extra note from the artist: ${note}.` : '',
    seeThrough
      ? 'Plain flat white background, one solid color, no scenery, no ground, and no shadows on the backdrop.'
      : 'Plain light background.',
    'No text and no watermark.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function scenePrompt(userPrompt: string) {
  return `${userPrompt}. Japanese manga background, bold ink, no readable text, no watermarks. ${ALL_AGES}`
}

function aspectForPose(pose: string | undefined): VeniceAspect {
  return !pose || pose === 'portrait' ? '1:1' : '2:3'
}

function mockEnabled(env: EmilyAiEnv) {
  return env.EMILY_MOCK_AI === '1'
}

function hasKey(env: EmilyAiEnv) {
  return Boolean(env.VENICE_API_KEY?.trim())
}

function pathOf(url: string) {
  return new URL(url).pathname
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  const origin = request.headers.get('origin')
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Emily-Passcode')
    headers.set('Access-Control-Max-Age', '86400')
  }
  headers.set('Cache-Control', 'no-store')
  return headers
}

function jsonResponse(request: Request, status: number, body: unknown): Response {
  const headers = corsHeaders(request)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

function originAllowed(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return ALLOWED_ORIGINS.has(origin)
}

async function passcodeMatches(provided: string, expected: string): Promise<boolean> {
  if (!expected) return false
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index]
  return diff === 0
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

function dayStamp(now: number) {
  return new Date(now).toISOString().slice(0, 10)
}

function rememberLimit(ip: string, now: number): string | null {
  const day = dayStamp(now)
  let bucket = buckets.get(ip)
  if (!bucket || now > bucket.reset) {
    bucket = { reset: now + WINDOW_MS, count: 0, day, dayCount: bucket && bucket.day === day ? bucket.dayCount : 0 }
  }
  if (bucket.day !== day) {
    bucket.day = day
    bucket.dayCount = 0
  }
  bucket.count += 1
  bucket.dayCount += 1
  buckets.set(ip, bucket)
  if (buckets.size > 500) {
    const oldest = buckets.keys().next().value
    if (oldest) buckets.delete(oldest)
  }
  if (bucket.dayCount > DAY_MAX) return 'That is enough drawings for today. Try again tomorrow.'
  if (bucket.count > WINDOW_MAX) return 'That is a lot of drawings in a short time. Wait a few minutes and try again.'
  return null
}

async function dailyKvLimit(store: EmilyDailyStore, ip: string, now: number): Promise<string | null> {
  const key = `emily-day:${dayStamp(now)}:${ip}`
  const current = Number((await store.get(key)) ?? '0')
  if (Number.isFinite(current) && current >= DAY_MAX) return 'That is enough drawings for today. Try again tomorrow.'
  await store.put(key, String((Number.isFinite(current) ? current : 0) + 1), { expirationTtl: 60 * 60 * 48 })
  return null
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The drawing did not work.'
  if (message.startsWith("Let's try a different idea")) return DIFFERENT_IDEA
  if (/api[_ ]?key|authorization|bearer|passcode/i.test(message)) return 'AI drawing is not turned on yet.'
  if (message.includes('too big') || message.includes('too small') || message.includes('JPG or PNG')) return message
  if (message.length > 180) return 'The drawing did not work. You can try again.'
  return message
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new Error('The picture needs to be a JPG or PNG.')
  return { mime: match[1], bytes: decodeBase64(match[2]) }
}

function pixelCount(bytes: Uint8Array, mime: string): number | null {
  if (mime.includes('png') && bytes.length >= 24 && ascii(bytes, 1, 4) === 'PNG') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return view.getUint32(16) * view.getUint32(20)
  }
  if ((mime.includes('jpeg') || mime.includes('jpg')) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null
      const marker = bytes[offset + 1]
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
        return height * width
      }
      offset += 2 + length
    }
  }
  return null
}

async function editFromPhoto(env: EmilyAiEnv, prompt: string, referenceDataUrl: string, aspectRatio: VeniceAspect) {
  const { bytes, mime } = dataUrlToBytes(referenceDataUrl)
  const pixels = pixelCount(bytes, mime)
  if (pixels !== null && pixels < MIN_PIXELS) {
    throw new Error('That picture is too small to draw from. Try a bigger photo.')
  }
  return editVeniceImage(settingsFrom(env), prompt, encodeBase64(bytes), aspectRatio)
}

class EmilyHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function isDifferentIdea(error: unknown) {
  return error instanceof Error && error.message.startsWith("Let's try a different idea")
}

async function finishCutout(env: EmilyAiEnv, imageDataUrl: string, transparent: boolean) {
  if (!transparent) return { imageDataUrl, localCutout: false }
  try {
    const { bytes } = dataUrlToBytes(imageDataUrl)
    const cut = await removeVeniceBackground(settingsFrom(env), encodeBase64(bytes))
    return { imageDataUrl: cut, localCutout: false }
  } catch (error) {
    if (isDifferentIdea(error)) throw error
    return { imageDataUrl, localCutout: true }
  }
}

function mockScene(prompt: string) {
  const label = prompt.replace(/[<>&]/g, '').slice(0, 80) || 'Practice background'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
    <rect width="1024" height="1536" fill="#f4efe4"/>
    <rect x="70" y="80" width="884" height="1376" fill="none" stroke="#171717" stroke-width="16"/>
    <circle cx="760" cy="280" r="90" fill="#ff8a4c"/>
    <path d="M120 980 C 280 820, 460 1100, 900 860" fill="none" stroke="#1b2838" stroke-width="18"/>
    <text x="512" y="1260" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#1b2838">${label}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function isApiPath(path: string) {
  return (
    path === '/api/generate-status' ||
    path === '/api/generate-character' ||
    path === '/api/generate-character-pose' ||
    path === '/api/generate-scene' ||
    path === '/api/remove-background'
  )
}

/**
 * Handles the AI routes. Returns null when the path is not one of them.
 * A browser Origin outside the Pages site and local Vite is rejected.
 */
export async function handleEmilyApi(request: Request, env: EmilyAiEnv, limits?: EmilyLimits): Promise<Response | null> {
  const path = pathOf(request.url)
  if (!isApiPath(path)) return null

  if (!originAllowed(request)) {
    return jsonResponse(request, 403, { error: 'This drawing service is only for EMily.' })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }

  if (request.method === 'GET' && path === '/api/generate-status') {
    const mock = mockEnabled(env)
    return jsonResponse(request, 200, {
      configured: hasKey(env) || mock,
      mock,
      needsPasscode: Boolean(env.requirePasscode),
    })
  }

  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'That request is not allowed.' })

  if (env.requirePasscode) {
    const provided = request.headers.get(PASSCODE_HEADER) ?? ''
    const ok = await passcodeMatches(provided, env.EMILY_PASSCODE?.trim() ?? '')
    if (!ok) {
      return jsonResponse(request, 401, { error: 'That magic word did not work. Ask your grown-up to try again.' })
    }
  }

  const limited = rememberLimit(clientIp(request), Date.now())
  if (limited) return jsonResponse(request, 429, { error: limited })
  if (limits?.daily) {
    try {
      const daily = await dailyKvLimit(limits.daily, clientIp(request), Date.now())
      if (daily) return jsonResponse(request, 429, { error: daily })
    } catch (error) {
      console.error('EMily daily limit skipped:', error instanceof Error ? error.message : 'unavailable')
    }
  }

  try {
    const raw = await request.arrayBuffer()
    if (raw.byteLength > MAX_BODY) return jsonResponse(request, 413, { error: 'That picture is too big to send.' })
    const text = new TextDecoder().decode(raw)
    const body = (text ? (JSON.parse(text) as JsonBody) : {}) ?? {}
    const result = await routePost(path, body, env)
    return jsonResponse(request, 200, result)
  } catch (error) {
    if (error instanceof EmilyHttpError) return jsonResponse(request, error.status, { error: error.message })
    if (error instanceof SyntaxError) return jsonResponse(request, 400, { error: 'That request could not be read.' })
    const message = safeError(error)
    console.error('EMily image request failed:', message)
    const status = message.includes('not turned on') ? 503 : message.startsWith("Let's try") ? 422 : 500
    return jsonResponse(request, status, { error: message })
  }
}

async function routePost(path: string, body: JsonBody, env: EmilyAiEnv) {
  if (path === '/api/remove-background') {
    const image = body.imageDataUrl || body.referenceDataUrl
    if (!image) throw new EmilyHttpError(400, 'Choose a picture first.')
    if (mockEnabled(env) || !hasKey(env)) return { imageDataUrl: image, localCutout: true }
    return finishCutout(env, image, true)
  }

  if (path === '/api/generate-scene') {
    const userPrompt = body.prompt?.trim()
    if (!userPrompt) throw new EmilyHttpError(400, 'Describe the background first.')
    if (mockEnabled(env)) {
      return { imageDataUrl: body.referenceDataUrl || mockScene(userPrompt), prompt: userPrompt }
    }
    const prompt = scenePrompt(userPrompt)
    const imageDataUrl = body.referenceDataUrl
      ? await editFromPhoto(env, prompt, body.referenceDataUrl, '2:3')
      : await generateVeniceImage(settingsFrom(env), prompt)
    return { imageDataUrl, prompt: userPrompt }
  }

  if (!body.referenceDataUrl) throw new EmilyHttpError(400, 'Choose a picture first.')

  const pose = path === '/api/generate-character-pose' ? body.prompt?.trim() || 'stand' : body.pose
  const prompt =
    path === '/api/generate-character-pose'
      ? characterPrompt({ ...body, pose: pose && POSES[pose] ? pose : 'stand', expression: body.expression })
      : characterPrompt(body)
  const seeThrough = body.transparent !== false
  if (mockEnabled(env)) return { imageDataUrl: body.referenceDataUrl, prompt, localCutout: seeThrough }

  const edited = await editFromPhoto(env, prompt, body.referenceDataUrl, aspectForPose(pose))
  const finished = await finishCutout(env, edited, seeThrough)
  return { ...finished, prompt }
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let text = ''
  for (let index = start; index < end; index += 1) text += String.fromCharCode(bytes[index] ?? 0)
  return text
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}
