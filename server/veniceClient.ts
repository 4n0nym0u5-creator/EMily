import OpenAI from 'openai'
import {
  DIFFERENT_IDEA,
  editVeniceImage as editWithSettings,
  generateVeniceImage as generateWithSettings,
  parseSafeMode,
  removeVeniceBackground as removeWithSettings,
  type VeniceAspect,
  type VeniceSettings,
} from '../shared/emilyAi.ts'

export { DIFFERENT_IDEA, parseSafeMode as veniceSafeMode, type VeniceAspect }

export const VENICE_BASE_URL = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1'
export const VENICE_IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL ?? 'wai-Illustrious'
export const VENICE_EDIT_MODEL = process.env.VENICE_EDIT_MODEL ?? 'firered-image-edit'
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

function currentSettings(): VeniceSettings {
  const apiKey = process.env.VENICE_API_KEY
  if (!apiKey) throw new Error('AI drawing is not turned on yet.')
  return {
    apiKey,
    baseUrl: VENICE_BASE_URL,
    imageModel: VENICE_IMAGE_MODEL,
    editModel: VENICE_EDIT_MODEL,
    safeMode: parseSafeMode(process.env.VENICE_SAFE_MODE),
  }
}

export function veniceFlagged(headers: { get(name: string): string | null }, safeMode = parseSafeMode(process.env.VENICE_SAFE_MODE)): boolean {
  if (headers.get('x-venice-is-content-violation') === 'true') return true
  return safeMode && headers.get('x-venice-is-blurred') === 'true'
}

export async function generateVeniceImage(prompt: string, width = 1024, height = 1024): Promise<string> {
  return generateWithSettings(currentSettings(), prompt, width, height)
}

export async function editVeniceImage(prompt: string, imageBase64: string, aspectRatio: VeniceAspect = '1:1'): Promise<string> {
  return editWithSettings(currentSettings(), prompt, imageBase64, aspectRatio)
}

export async function removeVeniceBackground(imageBase64: string): Promise<string> {
  return removeWithSettings(currentSettings(), imageBase64)
}
