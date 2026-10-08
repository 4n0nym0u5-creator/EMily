export type GenerateStatus = { configured: boolean }

async function postGenerate<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export async function fetchGenerateStatus(): Promise<GenerateStatus> {
  const res = await fetch('/api/generate-status')
  if (!res.ok) return { configured: false }
  return (await res.json()) as GenerateStatus
}

export async function generateCharacterFromReference(
  referenceDataUrl: string,
  prompt?: string,
): Promise<{ imageDataUrl: string; prompt: string }> {
  return postGenerate('/api/generate-character', {
    referenceDataUrl,
    prompt,
  })
}

export async function generateCharacterPose(
  characterDataUrl: string,
  pose: string,
): Promise<{ imageDataUrl: string; prompt: string }> {
  return postGenerate('/api/generate-character-pose', {
    referenceDataUrl: characterDataUrl,
    prompt: pose,
  })
}

export async function generateScene(
  prompt: string,
): Promise<{ imageDataUrl: string; prompt: string }> {
  return postGenerate('/api/generate-scene', { prompt })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
