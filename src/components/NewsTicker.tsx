/**
 * NewsTicker — live GDELT headlines for the active city, scrolling horizontally.
 *
 * A narrow strip below the topbar. Fetches on city change, auto-refreshes every
 * 5 minutes. Tone-coloured: negative tone = amber signal, neutral = dim.
 * Clicking a headline opens the source article.
 */
import { useEffect, useState, useRef } from 'react'
import type { CityConfig } from '../config/cities'
import { fetchCityNews, type GdeltArticle } from '../data/gdelt'

const REFRESH_MS = 5 * 60_000

interface Props {
  activeCity: CityConfig
}

export function NewsTicker({ activeCity }: Props) {
  const [articles, setArticles] = useState<GdeltArticle[]>([])
  const [loading, setLoading]   = useState(false)
  const animRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setArticles([])

    const load = async () => {
      try {
        const result = await fetchCityNews(activeCity.gdeltQuery, 12)
        if (!cancelled) {
          setArticles(result.articles.filter((a) => a.language === 'English' || a.language === ''))
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [activeCity.id, activeCity.gdeltQuery])

  if (loading && articles.length === 0) {
    return (
      <div className="news-ticker news-ticker--loading">
        <span className="news-ticker-label">NEWS</span>
        <span className="news-ticker-dim">Scanning GDELT…</span>
      </div>
    )
  }

  if (articles.length === 0) return null

  // Duplicate for seamless loop
  const items = [...articles, ...articles]

  return (
    <div className="news-ticker" aria-label={`Live news for ${activeCity.name}`}>
      <span className="news-ticker-label">NEWS</span>
      <div className="news-ticker-track-wrap">
        <div className="news-ticker-track" ref={animRef}>
          {items.map((a, i) => {
            const neg = a.tone < -3
            const pos = a.tone > 3
            return (
              <a
                key={`${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`news-ticker-item ${neg ? 'news-ticker-item--neg' : pos ? 'news-ticker-item--pos' : ''}`}
                title={`${a.domain} · tone ${a.tone > 0 ? '+' : ''}${a.tone.toFixed(0)}`}
              >
                {neg && <span className="news-ticker-dot news-ticker-dot--neg">▲</span>}
                {a.title}
                <span className="news-ticker-source">{a.domain}</span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
