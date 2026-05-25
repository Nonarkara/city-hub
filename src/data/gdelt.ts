/**
 * GDELT Doc API — global news + tone analysis.
 * Proxied through Cloudflare Worker for CORS.
 *
 * Rate limit: 1 req / 5 sec. We cache aggressively (5 min).
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/gdelt` : 'https://api.gdeltproject.org/api/v2'

const TTL = 5 * 60 * 1000

export interface GdeltArticle {
  url: string
  title: string
  seendate: string
  domain: string
  language: string
  tone: number // -100 to +100
}

export interface GdeltNewsResult {
  articles: GdeltArticle[]
  avgTone: number
}

export async function fetchBangkokNews(max = 8): Promise<GdeltNewsResult> {
  return cachedFetch('gdelt/bkk-news', async () => {
    const url =
      `${BASE}/doc/doc?query=` +
      encodeURIComponent('bangkok thailand') +
      `&mode=ArtList&maxrecords=${max}&format=json&sort=DateDesc`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GDELT ${res.status}`)
    const text = await res.text()
    // GDELT sometimes returns an HTML rate-limit page instead of JSON
    if (text.trim().startsWith('<')) {
      return { articles: [], avgTone: 0 }
    }
    const data = JSON.parse(text)
    const articles = (data?.articles ?? []) as Array<Record<string, unknown>>
    const parsed = articles.map((a): GdeltArticle => ({
      url: String(a.url ?? ''),
      title: String(a.title ?? 'Untitled'),
      seendate: String(a.seendate ?? ''),
      domain: String(a.domain ?? ''),
      language: String(a.language ?? ''),
      tone: Number(a.tone ?? 0),
    }))
    const avgTone = parsed.length
      ? parsed.reduce((s, a) => s + a.tone, 0) / parsed.length
      : 0
    return { articles: parsed, avgTone }
  }, TTL)
}
