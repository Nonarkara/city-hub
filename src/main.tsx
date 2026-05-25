import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'

// StrictMode intentionally omitted — imperative map libraries (MapLibre/unl-map-js)
// do not tolerate the double-mount dev behaviour and produce duplicate canvas instances.
createRoot(document.getElementById('root')!).render(<App />)
