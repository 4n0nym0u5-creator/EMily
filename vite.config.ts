import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { generateApiPlugin } from './server/generateApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), generateApiPlugin()],
})
