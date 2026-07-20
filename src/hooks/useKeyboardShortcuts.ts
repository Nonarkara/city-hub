/**
 * useKeyboardShortcuts — global hotkeys for the City Hub.
 *
 * Never fires when the user is focused in an input / textarea / contenteditable,
 * so typing in the chatbot or command palette never triggers these.
 *
 * Keys:
 *   1–5      → switch to city by index (BKK=1, CNX=2, HKT=3, SIN=4, KCH=5)
 *   g        → toggle globe projection
 *   f        → toggle forecast panel
 *   s        → toggle split compare
 *   a  or /  → toggle ASK chatbot
 *   Escape   → close any open panel (forecast → split → chat in priority order)
 */
import { useEffect } from 'react'
import type { CityConfig } from '../config/cities'

interface Handlers {
  allCities:      CityConfig[]
  activeCity:     CityConfig
  setActiveCity:  (c: CityConfig) => void
  globeView:      boolean
  setGlobeView:   (v: boolean) => void
  forecastOpen:   boolean
  setForecastOpen:(v: boolean) => void
  splitOpen:      boolean
  setSplitOpen:   (v: boolean) => void
  chatOpen:       boolean
  setChatOpen:    (v: boolean) => void
  cmdkOpen:       boolean
  setCmdkOpen:    (v: boolean) => void
  settingsOpen?:  boolean
  setSettingsOpen?:(v: boolean) => void
  onRunInsightScan?: () => void
}

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function useKeyboardShortcuts(h: Handlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack when modifier keys are held (browser shortcuts) or user is typing
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping()) return
      if (h.cmdkOpen) return  // command palette handles its own keys

      switch (e.key) {
        // City switch: 1–5
        case '1': case '2': case '3': case '4': case '5': {
          const idx = parseInt(e.key) - 1
          const city = h.allCities[idx]
          if (city && city.id !== h.activeCity.id) {
            h.setActiveCity(city)
            e.preventDefault()
          }
          break
        }

        // Globe toggle
        case 'g': case 'G':
          h.setGlobeView(!h.globeView)
          e.preventDefault()
          break

        // Forecast
        case 'f': case 'F':
          h.setForecastOpen(!h.forecastOpen)
          e.preventDefault()
          break

        // Split compare
        case 's': case 'S':
          h.setSplitOpen(!h.splitOpen)
          e.preventDefault()
          break

        // Ask / chat
        case '/':
          h.setChatOpen(!h.chatOpen)
          e.preventDefault()
          break

        // Settings
        case '?':
          if (h.setSettingsOpen) {
            h.setSettingsOpen(!h.settingsOpen)
            e.preventDefault()
          }
          break

        // Run insight scan
        case 'r': case 'R':
          if (h.onRunInsightScan) {
            h.onRunInsightScan()
            e.preventDefault()
          }
          break

        // Escape: close panels in priority order
        case 'Escape':
          if (h.settingsOpen && h.setSettingsOpen) { h.setSettingsOpen(false); e.preventDefault() }
          else if (h.forecastOpen) { h.setForecastOpen(false); e.preventDefault() }
          else if (h.splitOpen)   { h.setSplitOpen(false);   e.preventDefault() }
          else if (h.chatOpen)    { h.setChatOpen(false);    e.preventDefault() }
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    h.allCities, h.activeCity, h.globeView,
    h.forecastOpen, h.splitOpen, h.chatOpen, h.cmdkOpen,
    h.settingsOpen, h.setSettingsOpen, h.onRunInsightScan,
  ])
}
