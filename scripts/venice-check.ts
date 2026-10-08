// Quick connectivity check: `npm run venice:check`
import { config as loadEnv } from 'dotenv'
loadEnv()

const { getVeniceClient, VENICE_TEXT_MODEL, VENICE_BASE_URL } = await import('../server/veniceClient.ts')

const client = getVeniceClient()
const res = await client.chat.completions.create({
  model: VENICE_TEXT_MODEL,
  messages: [{ role: 'user', content: 'Reply with a short, cheerful one-line greeting for a young manga artist.' }],
  max_tokens: 60,
})

console.log(`Venice OK (${VENICE_BASE_URL}, model ${res.model})`)
console.log(res.choices[0]?.message?.content?.trim())
