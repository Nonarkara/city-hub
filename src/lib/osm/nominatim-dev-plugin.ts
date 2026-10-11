import type { Connect, Plugin } from 'vite'
import { handleNominatimRequest } from './nominatim-http'

/**
 * Same-origin `/api/nominatim` for `vite dev` and `vite preview`.
 * Production uses the Worker (`/nominatim`) or the Pages function.
 */
export function nominatimDevPlugin(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '').split('?')[0]
    if (path !== '/api/nominatim') {
      next()
      return
    }
    const url = new URL(req.url ?? '/api/nominatim', 'http://127.0.0.1')
    void handleNominatimRequest(url)
      .then(async (upstream) => {
        const body = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        const cache = upstream.headers.get('Cache-Control')
        if (cache) res.setHeader('Cache-Control', cache)
        res.end(body)
      })
      .catch((err) => {
        next(err)
      })
  }

  return {
    name: 'cityhub-nominatim',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
