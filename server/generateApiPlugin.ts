import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { config as loadEnv } from 'dotenv'
import OpenAI, { toFile } from 'openai'
import type { Plugin } from 'vite'

loadEnv()

type JsonBody = {
  referenceDataUrl?: string
  prompt?: string
}

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as JsonBody
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Reference image must be a base64 data URL.')
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY. Copy .env.example to .env and add your key.',
    )
  }
  return new OpenAI({ apiKey })
}

const CHARACTER_BASE_PROMPT = `Transform this reference photo into a Japanese shonen anime character portrait in the style of Haikyuu!!.
Keep the same face shape, hair color, hair style, skin tone, age, and distinctive features so it clearly looks like the same person.
Clean cel-shaded manga coloring, expressive eyes, soft lighting, bust portrait facing slightly toward camera.
Plain light background. No text, no watermark, no photo realism.`

const SCENE_STYLE =
  'Japanese shonen manga background art inspired by Haikyuu!!, dramatic composition, bold ink, warm gym lighting, no readable text, no watermarks, no people or faces unless necessary as tiny silhouettes.'

export function generateApiPlugin(): Plugin {
  return {
    name: 'emily-generate-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        if (req.method === 'GET' && req.url === '/api/generate-status') {
          return sendJson(res, 200, {
            configured: Boolean(process.env.OPENAI_API_KEY),
          })
        }

        if (req.method !== 'POST') return next()

        try {
          if (req.url === '/api/generate-character') {
            const body = await readJson(req)
            if (!body.referenceDataUrl) {
              return sendJson(res, 400, { error: 'referenceDataUrl is required' })
            }

            const { buffer, mime } = dataUrlToBuffer(body.referenceDataUrl)
            const ext = mime.includes('png') ? 'png' : 'jpg'
            const client = getClient()
            const prompt = body.prompt?.trim() || CHARACTER_BASE_PROMPT

            const result = await client.images.edit({
              model: 'gpt-image-1',
              image: await toFile(buffer, `emily-ref.${ext}`, { type: mime }),
              prompt,
              input_fidelity: 'high',
              size: '1024x1024',
              quality: 'medium',
            })

            const b64 = result.data?.[0]?.b64_json
            if (!b64) {
              return sendJson(res, 502, { error: 'No image returned from OpenAI.' })
            }

            return sendJson(res, 200, {
              imageDataUrl: `data:image/png;base64,${b64}`,
              prompt,
            })
          }

          if (req.url === '/api/generate-scene') {
            const body = await readJson(req)
            const userPrompt = body.prompt?.trim()
            if (!userPrompt) {
              return sendJson(res, 400, { error: 'prompt is required' })
            }

            const client = getClient()
            const prompt = `${userPrompt}. ${SCENE_STYLE}`

            const result = await client.images.generate({
              model: 'gpt-image-1',
              prompt,
              size: '1024x1536',
              quality: 'medium',
            })

            const b64 = result.data?.[0]?.b64_json
            if (!b64) {
              return sendJson(res, 502, { error: 'No image returned from OpenAI.' })
            }

            return sendJson(res, 200, {
              imageDataUrl: `data:image/png;base64,${b64}`,
              prompt: userPrompt,
            })
          }

          if (req.url === '/api/generate-character-pose') {
            const body = await readJson(req)
            if (!body.referenceDataUrl) {
              return sendJson(res, 400, { error: 'referenceDataUrl is required' })
            }
            const pose = body.prompt?.trim() || 'powerful volleyball spike jump pose'
            const { buffer, mime } = dataUrlToBuffer(body.referenceDataUrl)
            const ext = mime.includes('png') ? 'png' : 'jpg'
            const client = getClient()
            const prompt = `Using this anime character reference, draw the SAME character in a new full-body pose: ${pose}.
Haikyuu!! shonen manga style, keep face, hair, and outfit identity consistent, dynamic action lines, clean cel shading, plain or simple gym background, no text.`

            const result = await client.images.edit({
              model: 'gpt-image-1',
              image: await toFile(buffer, `character.${ext}`, { type: mime }),
              prompt,
              input_fidelity: 'high',
              size: '1024x1536',
              quality: 'medium',
            })

            const b64 = result.data?.[0]?.b64_json
            if (!b64) {
              return sendJson(res, 502, { error: 'No image returned from OpenAI.' })
            }

            return sendJson(res, 200, {
              imageDataUrl: `data:image/png;base64,${b64}`,
              prompt: pose,
            })
          }

          return next()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Generation failed'
          const status = message.includes('OPENAI_API_KEY') ? 503 : 500
          return sendJson(res, status, { error: message })
        }
      })
    },
  }
}
