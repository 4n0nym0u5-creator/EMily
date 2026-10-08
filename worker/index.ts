import { handleEmilyApi, type EmilyAiEnv, type EmilyDailyStore } from '../shared/emilyAi.ts'

export interface Env extends EmilyAiEnv {
  LIMITS?: EmilyDailyStore
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await handleEmilyApi(request, { ...env, requirePasscode: true }, env.LIMITS ? { daily: env.LIMITS } : undefined)
    if (response) return response
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  },
}
