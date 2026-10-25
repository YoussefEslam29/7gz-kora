import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { FeedbackProvider } from './components/feedback'
import { MotionProvider } from './components/motion'
import './index.css'
// Starts listening for Android's install prompt as early as possible.
import './lib/pwa'

// Installs the service worker (offline app shell, "Add to Home Screen").
// New versions are picked up automatically.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </MotionProvider>
  </StrictMode>,
)
