import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { config as loadEnv } from 'dotenv'
import type { Connect, Plugin } from 'vite'
import { handleEmilyApi, type EmilyAiEnv } from '../shared/emilyAi.ts'

loadEnv()

function envFromProcess(): EmilyAiEnv {
  return {
    VENICE_API_KEY: process.env.VENICE_API_KEY,
    VENICE_BASE_URL: process.env.VENICE_BASE_URL,
    VENICE_IMAGE_MODEL: process.env.VENICE_IMAGE_MODEL,
    VENICE_EDIT_MODEL: process.env.VENICE_EDIT_MODEL,
    VENICE_SAFE_MODE: process.env.VENICE_SAFE_MODE,
    EMILY_MOCK_AI: process.env.EMILY_MOCK_AI,
    EMILY_PASSCODE: process.env.EMILY_PASSCODE,
    requirePasscode: Boolean(process.env.EMILY_PASSCODE?.trim()),
  }
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? '127.0.0.1'
  const url = `http://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  if (req.method === 'GET' || req.method === 'HEAD') return new Request(url, { method: req.method, headers })
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return new Request(url, { method: req.method, headers, body: Buffer.concat(chunks) })
}

async function writeResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  res.end(Buffer.from(bytes))
}

function attach(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const path = req.url?.split('?')[0] ?? ''
    if (!path.startsWith('/api/')) return next()
    try {
      const response = await handleEmilyApi(await toWebRequest(req), envFromProcess())
      if (!response) return next()
      await writeResponse(res, response)
    } catch (error) {
      console.error('EMily image request failed:', error instanceof Error ? error.message : 'unknown')
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'The drawing did not work. You can try again.' }))
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
