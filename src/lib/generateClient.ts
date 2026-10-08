import type { StyleId, ExpressionId, PoseId } from './aiPresets'

const PASSCODE_KEY = 'emily-magic-word'
const PASSCODE_HEADER = 'X-Emily-Passcode'

export interface GenerateStatus {
  configured: boolean
  mock: boolean
  needsPasscode: boolean
}

export class PasscodeError extends Error {
  cancelled: boolean
  constructor(message: string, cancelled = false) {
    super(message)
    this.name = 'PasscodeError'
    this.cancelled = cancelled
  }
}

type AskForWord = (retry: boolean) => Promise<string | null>

let askForWord: AskForWord | null = null
let needsPasscode = false

export function registerMagicWord(ask: AskForWord | null) {
  askForWord = ask
}

export function rememberedPasscode(): string {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberPasscode(value: string) {
  localStorage.setItem(PASSCODE_KEY, value.trim())
}

export function forgetPasscode() {
  localStorage.removeItem(PASSCODE_KEY)
}

function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

async function sendGenerate<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const word = rememberedPasscode()
  if (word) headers[PASSCODE_HEADER] = word
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  let data: (T & { error?: string }) | null = null
  try {
    data = (await response.json()) as T & { error?: string }
  } catch {
    data = null
  }
  if (response.status === 401) {
    forgetPasscode()
    throw new PasscodeError(data?.error || 'That magic word did not work. Ask your grown-up to try again.')
  }
  if (!response.ok) {
    throw new Error(data?.error || 'The drawing did not work. You can try again.')
  }
  return data as T
}

async function ensureWord(retry: boolean): Promise<void> {
  if (!needsPasscode || rememberedPasscode()) return
  if (!askForWord) throw new PasscodeError('Ask your grown-up for the magic word.', true)
  const word = await askForWord(retry)
  if (!word?.trim()) throw new PasscodeError('Ask your grown-up for the magic word.', true)
  rememberPasscode(word)
}

async function postGenerate<T>(path: string, body: Record<string, unknown>): Promise<T> {
  await ensureWord(false)
  try {
    return await sendGenerate(path, body)
  } catch (error) {
    if (!(error instanceof PasscodeError) || error.cancelled) throw error
    forgetPasscode()
    if (!askForWord) throw error
    const word = await askForWord(true)
    if (!word?.trim()) throw new PasscodeError(error.message, true)
    rememberPasscode(word)
    return sendGenerate(path, body)
  }
}

export async function fetchGenerateStatus(): Promise<GenerateStatus> {
  const response = await fetch(apiUrl('/api/generate-status'))
  if (!response.ok) return { configured: false, mock: false, needsPasscode: false }
  const data = (await response.json()) as Partial<GenerateStatus>
  needsPasscode = Boolean(data.needsPasscode)
  return { configured: Boolean(data.configured), mock: Boolean(data.mock), needsPasscode: needsPasscode }
}

export interface GeneratedImage {
  imageDataUrl: string
  localCutout?: boolean
  prompt?: string
}

export async function generateCharacterLook(input: {
  referenceDataUrl: string
  style: StyleId
  expression: ExpressionId
  pose: PoseId
  note?: string
  transparent?: boolean
}): Promise<GeneratedImage> {
  return postGenerate('/api/generate-character', input)
}

export async function removeBackground(imageDataUrl: string): Promise<GeneratedImage> {
  return postGenerate('/api/remove-background', { imageDataUrl })
}

export async function generateSceneImage(input: {
  prompt: string
  referenceDataUrl?: string
}): Promise<{ imageDataUrl: string; prompt: string }> {
  return postGenerate('/api/generate-scene', input)
}
