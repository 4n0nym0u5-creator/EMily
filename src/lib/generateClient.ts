import type { StyleId, ExpressionId, PoseId } from './aiPresets'

export interface GenerateStatus {
  configured: boolean
  mock: boolean
}

async function postGenerate<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  let data: (T & { error?: string }) | null = null
  try {
    data = (await response.json()) as T & { error?: string }
  } catch {
    data = null
  }
  if (!response.ok) {
    throw new Error(data?.error || 'The drawing did not work. You can try again.')
  }
  return data as T
}

export async function fetchGenerateStatus(): Promise<GenerateStatus> {
  const response = await fetch('/api/generate-status')
  if (!response.ok) return { configured: false, mock: false }
  const data = (await response.json()) as Partial<GenerateStatus>
  return { configured: Boolean(data.configured), mock: Boolean(data.mock) }
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
