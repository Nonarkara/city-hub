import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { nominatimDevPlugin } from './src/lib/osm/nominatim-dev-plugin'

export default defineConfig({
  plugins: [react(), nominatimDevPlugin()],
  resolve: {
    alias: {
      // In-repo, not '../_shared'. That pointed outside the repository at
      // /Users/nonarkara/Projects/_shared — 1.9GB of unrelated content that a
      // fresh clone of this repo would not have, so `git clone && npm ci &&
      // npm run build` failed before it started. Only lib/ was ever imported
      // (by src/data/gistda.ts), so only lib/ is vendored here: 32KB, and
      // gistda.js has no imports of its own.
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
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
