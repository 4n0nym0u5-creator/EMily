import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@fontsource/dela-gothic-one/latin-400.css'
import '@fontsource/dela-gothic-one/japanese-400.css'
import '@fontsource/bangers/latin-400.css'
import '@fontsource/zen-maru-gothic/latin-400.css'
import '@fontsource/zen-maru-gothic/latin-500.css'
import '@fontsource/zen-maru-gothic/latin-700.css'
import '@fontsource/zen-maru-gothic/latin-900.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
