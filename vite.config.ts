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
  define: {
    // unl-core (CJS) references Node's `global` — polyfill for browser
    global: 'globalThis',
  },
})
