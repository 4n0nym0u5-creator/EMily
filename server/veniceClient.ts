import OpenAI from 'openai'

// Venice AI is OpenAI-compatible: same client, different base URL.
// The key is read from the environment (.env, gitignored) and never shipped to the browser.
export const VENICE_BASE_URL = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1'
export const VENICE_IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL ?? 'wai-Illustrious'
export const VENICE_TEXT_MODEL = process.env.VENICE_TEXT_MODEL ?? 'z-ai-glm-5-3-flash'

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
