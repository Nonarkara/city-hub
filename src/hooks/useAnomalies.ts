/**
 * Self-contained anomaly stream — fetches the inputs needed by
 * intelligence.detectAnomalies and returns the latest list. Used by the
 * map-level AnomalyPins component independently of AlertPanel.
 *
 * All fetches share keys with AlertPanel's cachedFetch so this incurs zero
 * additional HTTP traffic.
 */
import { useEffect, useState } from 'react'
import { bangkokPm25Live } from '../data/gistda'
import { bangkokWeather } from '../data/openmeteo'
import { bangkokAQI } from '../data/openmeteo-aq'
import { fetchTraffyGeoJSON } from '../data/traffy'
import { centralFloods } from '../data/gistda'
import { detectAnomalies, type Anomaly } from '../lib/intelligence'

const POLL_MS = 5 * 60_000

export function useAnomalies(enabled: boolean): Anomaly[] {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      const [p, w, f, a, tg] = await Promise.all([
        bangkokPm25Live().catch(() => null),
        bangkokWeather().catch(() => null),
        centralFloods().catch(() => null),
        bangkokAQI().catch(() => null),
        fetchTraffyGeoJSON(300).catch(() => null),
      ])
      if (cancelled) return
      // Derive Traffy stats from features (same logic as AlertPanel)
      let traffyStats = null
      if (tg && Array.isArray(tg.features)) {
        const byType: Record<string, number> = {}
        let active = 0
        for (const feat of tg.features) {
          const props = (feat.properties ?? {}) as Record<string, unknown>
          const types = (props.problem_type_fondue as string[]) ?? []
          if (String(props.state ?? '') !== 'เสร็จสิ้น') active++
          for (const t of types) byType[t] = (byType[t] ?? 0) + 1
        }
        traffyStats = {
          total: tg.features.length,
          active,
          finished: tg.features.length - active,
          byType,
        }
      }
      const floodCount = f && Array.isArray((f as { features?: unknown[] }).features)
        ? (f as { features: unknown[] }).features.length
        : 0
      setAnomalies(detectAnomalies(p, w, floodCount, a, traffyStats))
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [enabled])

  return anomalies
}
