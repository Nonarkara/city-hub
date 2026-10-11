import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { nominatimDevPlugin } from './src/lib/osm/nominatim-dev-plugin'

export default defineConfig({
  plugins: [react(), nominatimDevPlugin()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../_shared', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          mapbox: ['maplibre-gl'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/analytics', 'firebase/ai']
        }
      }
    }
  }
})
