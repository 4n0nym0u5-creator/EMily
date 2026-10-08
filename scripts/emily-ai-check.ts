import {
  characterPrompt,
  handleEmilyApi,
  resetEmilyLimitsForTests,
  type EmilyAiEnv,
} from '../shared/emilyAi.ts'

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function assert(name: string, ok: boolean, detail = '') {
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
  console.log('ok', name)
}

function fakePng(width: number, height: number) {
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:image/png;base64,${btoa(binary)}`
}

async function call(
  path: string,
  init: {
    method?: string
    body?: unknown
    raw?: string
    headers?: Record<string, string>
    origin?: string
    ip?: string
    env?: EmilyAiEnv
  } = {},
) {
  const method = init.method ?? 'POST'
  const headers = new Headers(init.headers)
  if (init.origin) headers.set('origin', init.origin)
  if (init.ip) headers.set('cf-connecting-ip', init.ip)
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const request = new Request(`https://emily-ai.example${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (init.raw ?? JSON.stringify(init.body ?? {})),
  })
  const response = await handleEmilyApi(request, init.env ?? { requirePasscode: true, EMILY_PASSCODE: 'spark' })
  if (!response) throw new Error(`no response for ${path}`)
  const text = await response.text()
  let json: Record<string, unknown> | null = null
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    json = null
  }
  return { status: response.status, headers: response.headers, json, text }
}

resetEmilyLimitsForTests()

const hidden = await call('/api/generate-status', { method: 'GET', env: { requirePasscode: true, VENICE_API_KEY: 'secret-key' } })
assert('status configured', hidden.status === 200 && hidden.json?.configured === true && hidden.json.needsPasscode === true)
assert('status hides the key', !hidden.text.includes('secret-key') && !hidden.text.includes('spark'))

const off = await call('/api/generate-status', { method: 'GET', env: { requirePasscode: true } })
assert('status without a key', off.json?.configured === false && off.json?.needsPasscode === true)

const local = await call('/api/generate-status', { method: 'GET', env: { EMILY_MOCK_AI: '1' } })
assert('local mock needs no word', local.json?.configured === true && local.json?.needsPasscode === false && local.json?.mock === true)

const missing = await call('/api/generate-character', { body: { referenceDataUrl: tinyPng }, ip: '1.1.1.1' })
assert('missing word is 401', missing.status === 401)

const wrong = await call('/api/generate-character', {
  body: { referenceDataUrl: tinyPng },
  headers: { 'X-Emily-Passcode': 'nope' },
  ip: '1.1.1.2',
})
assert('wrong word is 401', wrong.status === 401)

const shortWord = await call('/api/generate-character', {
  body: { referenceDataUrl: tinyPng },
  headers: { 'X-Emily-Passcode': 's' },
  ip: '1.1.1.3',
})
assert('short wrong word is 401', shortWord.status === 401)

const drawn = await call('/api/generate-character', {
  body: { referenceDataUrl: tinyPng, style: 'ink', expression: 'smile', pose: 'portrait', transparent: true },
  headers: { 'X-Emily-Passcode': 'spark' },
  ip: '1.1.1.4',
  env: { requirePasscode: true, EMILY_PASSCODE: 'spark', EMILY_MOCK_AI: '1' },
})
assert('mock character', drawn.status === 200 && drawn.json?.localCutout === true)
assert('all-ages prompt', String(drawn.json?.prompt).includes('Fully clothed, wholesome, all-ages'))
assert('flat background prompt', String(drawn.json?.prompt).includes('Plain flat white background'))

const kept = await call('/api/generate-character', {
  body: { referenceDataUrl: tinyPng, transparent: false },
  headers: { 'X-Emily-Passcode': 'spark' },
  ip: '1.1.1.5',
  env: { requirePasscode: true, EMILY_PASSCODE: 'spark', EMILY_MOCK_AI: '1' },
})
assert('see-through off', kept.json?.localCutout === false && String(kept.json?.prompt).includes('Plain light background'))
assert('prompt helper matches', characterPrompt({ transparent: false }).includes('all-ages'))

const removed = await call('/api/remove-background', {
  body: { imageDataUrl: tinyPng },
  headers: { 'X-Emily-Passcode': 'spark' },
  ip: '1.1.1.6',
  env: { requirePasscode: true, EMILY_PASSCODE: 'spark' },
})
assert('no key falls back locally', removed.status === 200 && removed.json?.localCutout === true)

const evil = await call('/api/generate-status', { method: 'GET', origin: 'https://evil.example', env: { requirePasscode: true } })
assert('other sites are blocked', evil.status === 403 && evil.headers.get('access-control-allow-origin') === null)

const pages = await call('/api/generate-status', {
  method: 'GET',
  origin: 'https://4n0nym0u5-creator.github.io',
  env: { requirePasscode: true, VENICE_API_KEY: 'k' },
})
assert('pages origin allowed', pages.headers.get('access-control-allow-origin') === 'https://4n0nym0u5-creator.github.io')

const localOrigin = await call('/api/generate-status', {
  method: 'GET',
  origin: 'http://127.0.0.1:5173',
  env: { EMILY_MOCK_AI: '1' },
})
assert('vite origin allowed', localOrigin.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5173')

const preflight = await call('/api/generate-character', {
  method: 'OPTIONS',
  origin: 'http://localhost:5173',
  env: { requirePasscode: true, EMILY_PASSCODE: 'spark' },
})
assert('preflight', preflight.status === 204 && (preflight.headers.get('access-control-allow-headers') ?? '').includes('X-Emily-Passcode'))

resetEmilyLimitsForTests()
let limited = 0
for (let index = 0; index < 9; index += 1) {
  const result = await call('/api/remove-background', {
    body: { imageDataUrl: tinyPng },
    headers: { 'X-Emily-Passcode': 'spark' },
    ip: '9.9.9.9',
    env: { requirePasscode: true, EMILY_PASSCODE: 'spark' },
  })
  if (result.status === 429) limited = index + 1
}
assert('rate limit', limited === 9, String(limited))

const bulky = await call('/api/remove-background', {
  raw: `{"imageDataUrl":"${'a'.repeat(12 * 1024 * 1024 + 20)}"}`,
  headers: { 'X-Emily-Passcode': 'spark' },
  ip: '8.8.8.8',
})
assert('body cap', bulky.status === 413)

const big = fakePng(256, 256)
const calls: Array<{ url: string; body: Record<string, unknown> }> = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>
  calls.push({ url, body })
  if (url.endsWith('/image/edit') && body.prompt === 'violation') {
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/png', 'x-venice-is-content-violation': 'true' },
    })
  }
  const png = Uint8Array.from(atob(tinyPng.split(',')[1]), (char) => char.charCodeAt(0))
  return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
}

try {
  const edited = await call('/api/generate-character', {
    body: { referenceDataUrl: big, transparent: true, pose: 'portrait' },
    headers: { 'X-Emily-Passcode': 'spark' },
    ip: '4.4.4.4',
    env: { requirePasscode: true, EMILY_PASSCODE: 'spark', VENICE_API_KEY: 'vk' },
  })
  assert('edit then cutout', edited.status === 200 && String(edited.json?.imageDataUrl).startsWith('data:image/png'))
  assert('safe mode off', calls[0]?.body.safe_mode === false)
  assert('edit model', calls[0]?.url.endsWith('/image/edit') && calls[0]?.body.model === 'firered-image-edit')
  assert('cutout has only the image', calls[1]?.url.endsWith('/image/background-remove') && Object.keys(calls[1]?.body ?? {}).join() === 'image')
  assert('cutout skips safe mode', calls[1]?.body.safe_mode === undefined && calls[1]?.body.model === undefined)

  calls.length = 0
  const blocked = await call('/api/generate-character', {
    body: { referenceDataUrl: big, note: 'violation', pose: 'stand' },
    headers: { 'X-Emily-Passcode': 'spark' },
    ip: '4.4.4.5',
    env: { requirePasscode: true, EMILY_PASSCODE: 'spark', VENICE_API_KEY: 'vk' },
  })
  // The violation marker is on the edit response when the built prompt is exactly "violation".
  // Use a direct prompt path by sending pose text that is not the whole prompt.
  assert('violation setup ran', blocked.status === 200 || blocked.status === 422)
} finally {
  globalThis.fetch = originalFetch
}

calls.length = 0
globalThis.fetch = async (input, init) => {
  const url = String(input)
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>
  calls.push({ url, body })
  if (String(body.prompt).includes('MARKER-VIOLATION')) {
    return new Response(new Uint8Array([9]), {
      status: 200,
      headers: { 'content-type': 'image/png', 'x-venice-is-content-violation': 'true' },
    })
  }
  const png = Uint8Array.from(atob(tinyPng.split(',')[1]), (char) => char.charCodeAt(0))
  return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
}
try {
  const blocked = await call('/api/generate-character', {
    body: { referenceDataUrl: big, note: 'MARKER-VIOLATION', pose: 'portrait', transparent: true },
    headers: { 'X-Emily-Passcode': 'spark' },
    ip: '4.4.4.6',
    env: { requirePasscode: true, EMILY_PASSCODE: 'spark', VENICE_API_KEY: 'vk' },
  })
  assert('violation hides the picture', blocked.status === 422 && String(blocked.json?.error).startsWith("Let's try a different idea"))
  assert('violation does not cut out', calls.length === 1)
} finally {
  globalThis.fetch = originalFetch
}

console.log('emily ai checks passed')
