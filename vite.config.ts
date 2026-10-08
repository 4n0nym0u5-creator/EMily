import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { generateApiPlugin } from './server/generateApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // Pages builds set VITE_BASE=/EMily/. Local dev leaves it unset and stays at /.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), generateApiPlugin()],
})
