import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

// StrictMode intentionally omitted — imperative map libraries (Mapbox GL JS)
// do not tolerate the double-mount dev behaviour and produce duplicate canvas instances.
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)

// Register service worker for PWA — only in production to avoid dev caching pain
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[sw] registration failed', err))
  })
}

// Self-heal stale shells: if a lazy chunk 404s after a deploy (old index.html
// referencing deleted hashed assets), force a one-time reload so the
// network-first SW serves the fresh shell.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const KEY = 'vite-preload-reload'
  if (!sessionStorage.getItem(KEY)) {
    sessionStorage.setItem(KEY, '1')
    location.reload()
  }
})
