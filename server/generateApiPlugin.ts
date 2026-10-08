import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { config as loadEnv } from 'dotenv'
import type { Connect, Plugin } from 'vite'
import { DIFFERENT_IDEA, editVeniceImage, generateVeniceImage, hasVeniceKey, type VeniceAspect } from './veniceClient.js'

loadEnv()

const MAX_BODY = 12 * 1024 * 1024

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

type JsonBody = {
  referenceDataUrl?: string
  prompt?: string
  style?: string
  expression?: string
  pose?: string
  note?: string
}

function mockEnabled() {
  return process.env.EMILY_MOCK_AI === '1'
}

function pick(map: Record<string, string>, id: string | undefined, fallback: string) {
  if (id && map[id]) return map[id]
  return map[fallback] ?? fallback
}

function cleanNote(note: string | undefined) {
  if (!note) return ''
  return note.replace(/\s+/g, ' ').trim().slice(0, 180)
}

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error('That picture is too big to send.')
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as JsonBody
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new Error('The picture needs to be a JPG or PNG.')
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

const ALL_AGES = 'Fully clothed, wholesome, all-ages manga. No scary, violent, or adult content.'

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The drawing did not work.'
  if (message.startsWith("Let's try a different idea")) return DIFFERENT_IDEA
  if (/api[_ ]?key|authorization|bearer/i.test(message)) return 'AI drawing is not turned on yet.'
  if (message.includes('too big') || message.includes('too small') || message.includes('JPG or PNG')) return message
  if (message.length > 180) return 'The drawing did not work. You can try again.'
  return message
}

function characterPrompt(body: JsonBody) {
  const style = pick(STYLES, body.style, 'haikyuu')
  const expression = pick(EXPRESSIONS, body.expression, 'smile')
  const pose = pick(POSES, body.pose, 'portrait')
  const note = cleanNote(body.note)
  return [
    'Redraw this person as a manga character.',
    'Keep the same face shape, hair color, hair style, skin tone, age, and distinctive features.',
    ALL_AGES,
    `Style: ${style}.`,
    `Expression: ${expression}.`,
    `Pose: ${pose}.`,
    note ? `Extra note from the artist: ${note}.` : '',
    'Plain light background. No text and no watermark.',
  ]
    .filter(Boolean)
    .join(' ')
}

function scenePrompt(userPrompt: string) {
  return `${userPrompt}. Japanese manga background, bold ink, no readable text, no watermarks. ${ALL_AGES}`
}

function aspectForPose(pose: string | undefined): VeniceAspect {
  return !pose || pose === 'portrait' ? '1:1' : '2:3'
}

function pixelCount(buffer: Buffer, mime: string): number | null {
  if (mime.includes('png') && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return buffer.readUInt32BE(16) * buffer.readUInt32BE(20)
  }
  if ((mime.includes('jpeg') || mime.includes('jpg')) && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return buffer.readUInt16BE(offset + 5) * buffer.readUInt16BE(offset + 7)
      }
      offset += 2 + length
    }
  }
  return null
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

async function editFromPhoto(prompt: string, referenceDataUrl: string, aspectRatio: VeniceAspect) {
  const { buffer, mime } = dataUrlToBuffer(referenceDataUrl)
  const pixels = pixelCount(buffer, mime)
  if (pixels !== null && pixels < 65_536) {
    throw new Error('That picture is too small to draw from. Try a bigger photo.')
  }
  return editVeniceImage(prompt, buffer.toString('base64'), aspectRatio)
}

function pathOf(url: string | undefined) {
  return url?.split('?')[0] ?? ''
}

function attach(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const path = pathOf(req.url)
    if (!path.startsWith('/api/')) return next()

    if (req.method === 'GET' && path === '/api/generate-status') {
      const mock = mockEnabled()
      return sendJson(res, 200, {
        configured: hasVeniceKey() || mock,
        mock,
      })
    }

    if (req.method !== 'POST') return next()
    if (
      path !== '/api/generate-character' &&
      path !== '/api/generate-scene' &&
      path !== '/api/generate-character-pose'
    ) {
      return next()
    }

    try {
      const body = await readJson(req)
      if (path === '/api/generate-scene') {
        const userPrompt = body.prompt?.trim()
        if (!userPrompt) return sendJson(res, 400, { error: 'Describe the background first.' })
        if (mockEnabled()) {
          return sendJson(res, 200, {
            imageDataUrl: body.referenceDataUrl || mockScene(userPrompt),
            prompt: userPrompt,
          })
        }
        const prompt = scenePrompt(userPrompt)
        const imageDataUrl = body.referenceDataUrl
          ? await editFromPhoto(prompt, body.referenceDataUrl, '2:3')
          : await generateVeniceImage(prompt)
        return sendJson(res, 200, { imageDataUrl, prompt: userPrompt })
      }

      if (!body.referenceDataUrl) {
        return sendJson(res, 400, { error: 'Choose a picture first.' })
      }

      const pose = path === '/api/generate-character-pose' ? body.prompt?.trim() || 'stand' : body.pose
      const prompt =
        path === '/api/generate-character-pose'
          ? characterPrompt({ ...body, pose: pose && POSES[pose] ? pose : 'stand', expression: body.expression })
          : characterPrompt(body)

      if (mockEnabled()) {
        return sendJson(res, 200, { imageDataUrl: body.referenceDataUrl, prompt })
      }

      const imageDataUrl = await editFromPhoto(prompt, body.referenceDataUrl, aspectForPose(pose))
      return sendJson(res, 200, { imageDataUrl, prompt })
    } catch (error) {
      const message = safeError(error)
      console.error('EMily image request failed:', message)
      const status = message.includes('not turned on') ? 503 : message.startsWith("Let's try") ? 422 : 500
      return sendJson(res, status, { error: message })
    }
  })
}

export function generateApiPlugin(): Plugin {
  return {
    name: 'emily-generate-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
