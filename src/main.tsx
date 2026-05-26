import { createRoot } from 'react-dom/client'
import 'mapbox-gl/dist/mapbox-gl.css'
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
