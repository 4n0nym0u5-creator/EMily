import OpenAI from 'openai'

// Venice AI is OpenAI-compatible: same client, different base URL.
// The key is read from the environment (.env, gitignored) and never shipped to the browser.
export const VENICE_BASE_URL = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1'
export const VENICE_IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL ?? 'wai-Illustrious'
export const VENICE_EDIT_MODEL = process.env.VENICE_EDIT_MODEL ?? 'firered-image-edit'
export const VENICE_TEXT_MODEL = process.env.VENICE_TEXT_MODEL ?? 'z-ai-glm-5-3-flash'

export const DIFFERENT_IDEA =
  "Let's try a different idea. That drawing was not kept. Try another expression, or a simpler note like a volleyball jersey."

const EDIT_ASPECTS = ['auto', '1:1', '3:2', '16:9', '21:9', '9:16', '2:3', '3:4', '4:3', '4:5'] as const
export type VeniceAspect = (typeof EDIT_ASPECTS)[number]

const FIRE_RED_PROMPT_LIMIT = 1500

export function hasVeniceKey(): boolean {
  return Boolean(process.env.VENICE_API_KEY)
}

export function getVeniceClient(): OpenAI {
  const apiKey = process.env.VENICE_API_KEY
  if (!apiKey) {
    throw new Error('VENICE_API_KEY is not set. Add it to .env (see .env.example).')
  }
  return new OpenAI({ apiKey, baseURL: VENICE_BASE_URL })
}

/** One switch for every picture request. Unset means off. */
export function veniceSafeMode(): boolean {
  const value = process.env.VENICE_SAFE_MODE?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on' || value === 'yes'
}

export function veniceFlagged(headers: { get(name: string): string | null }, safeMode = veniceSafeMode()): boolean {
  if (headers.get('x-venice-is-content-violation') === 'true') return true
  return safeMode && headers.get('x-venice-is-blurred') === 'true'
}

function veniceKey(): string {
  const apiKey = process.env.VENICE_API_KEY
  if (!apiKey) throw new Error('AI drawing is not turned on yet.')
  return apiKey
}

async function veniceFailure(response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) {
    return new Error('AI drawing is not turned on yet.')
  }
  return new Error('The drawing did not work. You can try again.')
}

async function discardAndRejectIfFlagged(response: Response, safeMode: boolean) {
  if (!veniceFlagged(response.headers, safeMode)) return
  await response.arrayBuffer().catch(() => undefined)
  throw new Error(DIFFERENT_IDEA)
}

/** Text-only pictures. wai-Illustrious does not accept a reference photo. */
export async function generateVeniceImage(prompt: string, width = 1024, height = 1024): Promise<string> {
  const safeMode = veniceSafeMode()
  const response = await fetch(`${VENICE_BASE_URL}/image/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${veniceKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VENICE_IMAGE_MODEL,
      prompt,
      negative_prompt: 'nudity, violence, gore, scary, text, watermark, photograph',
      width,
      height,
      safe_mode: safeMode,
      format: 'png',
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const data = (await response.json()) as { images?: string[] }
  const image = data.images?.[0]
  if (!image) throw new Error('The drawing did not come back. You can try again.')
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`
}

/**
 * Photo or drawing reference. FireRed returns raw PNG bytes, not JSON.
 * safe_mode comes from VENICE_SAFE_MODE and is not taken from the browser.
 */
export async function editVeniceImage(prompt: string, imageBase64: string, aspectRatio: VeniceAspect = '1:1'): Promise<string> {
  const safeMode = veniceSafeMode()
  const response = await fetch(`${VENICE_BASE_URL}/image/edit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${veniceKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VENICE_EDIT_MODEL,
      prompt: prompt.slice(0, FIRE_RED_PROMPT_LIMIT),
      image: imageBase64.replace(/\s/g, ''),
      safe_mode: safeMode,
      output_format: 'png',
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) throw new Error('The drawing did not come back. You can try again.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 32) throw new Error('The drawing did not come back. You can try again.')
  const mime = type.split(';')[0] || 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

/**
 * Cut a picture out onto a transparent PNG.
 * POST /image/background-remove takes only the image (no model, no safe_mode).
 * A content violation still hides the picture. Other failures are for the caller to fall back from.
 */
export async function removeVeniceBackground(imageBase64: string): Promise<string> {
  const safeMode = veniceSafeMode()
  const response = await fetch(`${VENICE_BASE_URL}/image/background-remove`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${veniceKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64.replace(/\s/g, ''),
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response, safeMode)
  if (!response.ok) throw await veniceFailure(response)
  const type = response.headers.get('content-type') ?? ''
  const bytes = Buffer.from(await response.arrayBuffer())
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG'
  if (!type.startsWith('image/') && !png) throw new Error('The see-through step did not come back. You can try again.')
  if (bytes.length < 32) throw new Error('The see-through step did not come back. You can try again.')
  return `data:image/png;base64,${bytes.toString('base64')}`
}
