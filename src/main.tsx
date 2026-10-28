import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { unlockAudio } from './ui/feedback'

// Áudio só é liberado depois de um toque do usuário.
addEventListener('pointerdown', unlockAudio, { capture: true, passive: true })

// Service worker só no build: em desenvolvimento atrapalharia o recarregamento.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
