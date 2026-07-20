import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
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
