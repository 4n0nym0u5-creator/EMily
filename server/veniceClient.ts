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

export function veniceFlagged(headers: { get(name: string): string | null }): boolean {
  return headers.get('x-venice-is-blurred') === 'true' || headers.get('x-venice-is-content-violation') === 'true'
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

async function discardAndRejectIfFlagged(response: Response) {
  if (!veniceFlagged(response.headers)) return
  await response.arrayBuffer().catch(() => undefined)
  throw new Error(DIFFERENT_IDEA)
}

/** Text-only pictures. wai-Illustrious does not accept a reference photo. */
export async function generateVeniceImage(prompt: string, width = 1024, height = 1024): Promise<string> {
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
      safe_mode: true,
      format: 'png',
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response)
  if (!response.ok) throw await veniceFailure(response)
  const data = (await response.json()) as { images?: string[] }
  const image = data.images?.[0]
  if (!image) throw new Error('The drawing did not come back. You can try again.')
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`
}

/**
 * Photo or drawing reference. FireRed returns raw PNG bytes, not JSON.
 * safe_mode is always true and is not taken from the browser.
 */
export async function editVeniceImage(prompt: string, imageBase64: string, aspectRatio: VeniceAspect = '1:1'): Promise<string> {
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
      safe_mode: true,
      output_format: 'png',
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  await discardAndRejectIfFlagged(response)
  if (!response.ok) throw await veniceFailure(response)
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) throw new Error('The drawing did not come back. You can try again.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 32) throw new Error('The drawing did not come back. You can try again.')
  const mime = type.split(';')[0] || 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}
