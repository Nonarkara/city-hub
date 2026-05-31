/**
 * useShareableView — two-way sync between the dashboard view and the URL.
 *
 * On first mount: reads ?city=&lens=&date=&overlays=&globe= and applies it,
 * so a shared link opens the exact same view. Thereafter: mirrors view state
 * back into the URL via replaceState (no history spam), so the address bar —
 * and the SHARE button — always reflect what you're looking at.
 *
 * This is the link you paste in WhatsApp: it reopens precisely your view.
 */
import { useEffect, useRef } from 'react'
import { CITIES, type BasemapId } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useUIStore } from '../store/uiStore'
import { BASEMAPS } from '../components/MapView'

const KNOWN_OVERLAYS = new Set(['quakes', 'radar'])

export function useShareableView() {
  const applied = useRef(false)

  // URL → state, once
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    const p = new URLSearchParams(window.location.search)
    const cs = useCityStore.getState()
    const us = useUIStore.getState()

    const cityKey = p.get('city')
    if (cityKey) {
      const all = [...CITIES, ...cs.customCities]
      const city = all.find((c) => c.id === cityKey || c.hudClockLabel.toLowerCase() === cityKey.toLowerCase())
      if (city) cs.setActiveCity(city)
    }
    const lens = p.get('lens')
    if (lens && (BASEMAPS as string[]).includes(lens)) us.setBasemap(lens as BasemapId)

    const date = p.get('date')
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) us.setActiveDate(date)

    const overlays = p.get('overlays')
    if (overlays) overlays.split(',').filter((id) => KNOWN_OVERLAYS.has(id)).forEach((id) => us.toggleOverlay(id))

    if (p.get('globe') === '1') us.setGlobeView(true)
  }, [])

  // state → URL
  const activeCity     = useCityStore((s) => s.activeCity)
  const customCities   = useCityStore((s) => s.customCities)
  const basemap        = useUIStore((s) => s.basemap)
  const activeDate     = useUIStore((s) => s.activeDate)
  const activeOverlays = useUIStore((s) => s.activeOverlays)
  const globeView      = useUIStore((s) => s.globeView)

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('city', activeCity.id)
    p.set('lens', basemap)
    if (activeDate) p.set('date', activeDate)
    if (activeOverlays.size) p.set('overlays', [...activeOverlays].join(','))
    if (globeView) p.set('globe', '1')
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`)
  }, [activeCity.id, basemap, activeDate, activeOverlays, globeView, customCities])
}
