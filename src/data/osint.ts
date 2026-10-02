/**
 * Open-source picture of a city — what public web already publishes.
 *
 * Wikipedia (summary + nearby articles) and GDELT (news tone, outlets, headline
 * themes). No social-network scraping. Theme counts are keyword matches on
 * headlines, not a survey of public opinion.
 */
import type { CityConfig } from '../config/cities'
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'
import { fetchCityNews, type GdeltArticle } from './gdelt'

const WIKI = 'https://en.wikipedia.org/w/api.php'
const DAY = 24 * 60 * 60 * 1000

export interface WikiSummary {
  title: string
  extract: string
  description: string
  url: string
  thumbnail: string | null
}

export interface WikiPlace {
  title: string
  lat: number
  lng: number
  distM: number
}

export interface HeadlineTheme {
  id: string
  label: string
  count: number
}

export interface CityDossier {
  wiki: WikiSummary | null
  articles: GdeltArticle[]
  avgTone: number
  domains: { domain: string; count: number }[]
  languages: { language: string; count: number }[]
  themes: HeadlineTheme[]
  lead: string
}

const THEMES: { id: string; label: string; words: string[] }[] = [
  { id: 'economy', label: 'Economy', words: ['gdp', 'economy', 'economic', 'market', 'trade', 'invest', 'jobs', 'unemployment', 'inflation', 'bank', 'stock', 'business'] },
  { id: 'politics', label: 'Politics', words: ['election', 'minister', 'government', 'mayor', 'parliament', 'protest', 'policy', 'president', 'coalition', 'vote'] },
  { id: 'disaster', label: 'Disaster', words: ['flood', 'fire', 'quake', 'earthquake', 'storm', 'landslide', 'drought', 'typhoon', 'cyclone', 'wildfire', 'evacuate'] },
  { id: 'climate', label: 'Climate & air', words: ['heat', 'climate', 'pollution', 'emission', 'temperature', 'smog', 'aqi', 'haze', 'warming'] },
  { id: 'security', label: 'Security', words: ['crime', 'police', 'attack', 'arrest', 'military', 'war', 'shooting', 'terror', 'border'] },
  { id: 'health', label: 'Health', words: ['hospital', 'covid', 'disease', 'health', 'vaccine', 'outbreak', 'virus', 'dengue'] },
  { id: 'culture', label: 'Culture', words: ['festival', 'museum', 'tourism', 'tourist', 'art', 'sport', 'film', 'music', 'heritage'] },
]

function toneWord(tone: number): string {
  if (tone <= -5) return 'sour'
  if (tone <= -2) return 'cool'
  if (tone >= 5) return 'warm'
  if (tone >= 2) return 'mildly positive'
  return 'mixed'
}

/** Short words only count as whole words, so "art" does not match "start". */
function themeHit(hay: string, word: string): boolean {
  if (word.length >= 5) return hay.includes(word)
  return new RegExp(`(?:^|[^a-z])${word}(?:$|[^a-z])`).test(hay)
}

export function classifyThemes(titles: string[]): HeadlineTheme[] {
  const counts = new Map<string, number>()
  for (const title of titles) {
    const hay = title.toLowerCase()
    for (const theme of THEMES) {
      if (theme.words.some((w) => themeHit(hay, w))) {
        counts.set(theme.id, (counts.get(theme.id) ?? 0) + 1)
      }
    }
  }
  return THEMES
    .map((t) => ({ id: t.id, label: t.label, count: counts.get(t.id) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
}

function tally(values: string[]): { key: string; count: number }[] {
  const map = new Map<string, number>()
  for (const v of values) {
    const key = v.trim()
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

async function wikiSearchTitle(query: string): Promise<string | null> {
  const url =
    `${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    '&srlimit=1&format=json&origin=*'
  const res = await fetch(url, { signal: timeoutSignal(12_000) })
  if (!res.ok) throw new Error(`Wikipedia search ${res.status}`)
  const data = await res.json()
  const title = data?.query?.search?.[0]?.title
  return typeof title === 'string' && title ? title : null
}

async function wikiSummaryByTitle(title: string): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const res = await fetch(url, { signal: timeoutSignal(12_000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Wikipedia summary ${res.status}`)
  const data = await res.json()
  if (data?.type === 'disambiguation') return null
  const extract = String(data?.extract ?? '').trim()
  if (!extract) return null
  return {
    title: String(data.title ?? title),
    extract,
    description: String(data.description ?? ''),
    url: String(data?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`),
    thumbnail: typeof data?.thumbnail?.source === 'string' ? data.thumbnail.source : null,
  }
}

/** English Wikipedia lead for a city. Cached a day — the article does not move. */
export async function fetchWikiSummary(city: Pick<CityConfig, 'name' | 'countryName'>): Promise<WikiSummary | null> {
  const key = `wiki/summary/${city.name}/${city.countryName}`
  return cachedFetch(key, async () => {
    const title =
      (await wikiSearchTitle(`${city.name} ${city.countryName}`).catch(() => null)) ??
      (await wikiSearchTitle(city.name).catch(() => null))
    if (!title) return null
    return wikiSummaryByTitle(title)
  }, DAY)
}

/** Notable Wikipedia articles near a point. Radius is metres, max 10 km. */
export async function fetchWikiNearby(lat: number, lng: number, radiusM: number): Promise<WikiPlace[]> {
  const radius = Math.round(Math.min(10_000, Math.max(100, radiusM)))
  const key = `wiki/near/${lat.toFixed(2)},${lng.toFixed(2)}/${Math.round(radius / 500)}`
  return cachedFetch(key, async () => {
    const url =
      `${WIKI}?action=query&list=geosearch&gscoord=${lat}|${lng}` +
      `&gsradius=${radius}&gslimit=6&format=json&origin=*`
    const res = await fetch(url, { signal: timeoutSignal(12_000) })
    if (!res.ok) throw new Error(`Wikipedia geosearch ${res.status}`)
    const data = await res.json()
    const rows = (data?.query?.geosearch ?? []) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      title: String(r.title ?? ''),
      lat: Number(r.lat),
      lng: Number(r.lon),
      distM: Number(r.dist ?? 0),
    })).filter((p) => p.title)
  }, 10 * 60_000)
}

function buildLead(cityName: string, wiki: WikiSummary | null, articles: GdeltArticle[], avgTone: number, domains: { domain: string; count: number }[], themes: HeadlineTheme[]): string {
  const parts: string[] = []
  if (wiki?.description) parts.push(`${wiki.title}: ${wiki.description}.`)
  if (articles.length > 0) {
    parts.push(
      `Across ${articles.length} recent GDELT headlines the tone on ${cityName} is ${toneWord(avgTone)} (${avgTone > 0 ? '+' : ''}${avgTone.toFixed(1)}).`,
    )
    if (domains[0]) parts.push(`The outlet that shows up most is ${domains[0].domain} (${domains[0].count}).`)
    if (themes[0]) parts.push(`Headline theme that repeats: ${themes[0].label.toLowerCase()} (${themes[0].count} of ${articles.length}).`)
  } else if (!wiki) {
    parts.push(`No Wikipedia lead or fresh headlines came back for ${cityName}.`)
  }
  return parts.join(' ')
}

/** What the open web currently says about this city. */
export async function fetchCityDossier(city: CityConfig): Promise<CityDossier> {
  const [wikiRes, newsRes] = await Promise.allSettled([
    fetchWikiSummary(city),
    fetchCityNews(city.gdeltQuery, 25),
  ])
  const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : null
  const news = newsRes.status === 'fulfilled' ? newsRes.value : null
  const articles = news?.articles ?? []
  const avgTone = news?.avgTone ?? 0
  const domains = tally(articles.map((a) => a.domain)).slice(0, 5).map((d) => ({ domain: d.key, count: d.count }))
  const languages = tally(articles.map((a) => a.language || 'und')).slice(0, 4).map((d) => ({ language: d.key, count: d.count }))
  const themes = classifyThemes(articles.map((a) => a.title))
  return {
    wiki,
    articles: articles.slice(0, 8),
    avgTone,
    domains,
    languages,
    themes,
    lead: buildLead(city.name, wiki, articles, avgTone, domains, themes),
  }
}
