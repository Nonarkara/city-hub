# UNL City Hub — Mobile Fix · 2026-05-26

**Version:** 0.5.1 (patch bump from 0.5.0)
**Live:** https://unl-city-hub.pages.dev/
**Scope:** Layout / CSS only. No data, no map config, no feature changes.

## What was broken on mobile

Tested at 390×844 (iPhone 14/15), 360×800 (Android common), 320×568 (iPhone SE), 768×1024 (iPad).

1. **Topbar overflowed the viewport.** Total scroll width was 497 px at a 390 px viewport — "UNL VPM", "⌘K", and even part of "SIT ROOM" were pushed off-screen.
2. **The governor briefing was completely invisible on mobile.** `.alert-panel` was `display: none` below 768 px, which hid the morning brief, PM2.5 provincial rank, TMD forecast, TimeFM forecast, alert cards, GDELT news, and aphorism — i.e. the heart of the dashboard.
3. **TimeScrubber covered 72 px** of the top of the map (slider + tick row at full size).
4. **HUD bottom-corner brackets** sat on top of the freshness panel and (newly) the peek strip.
5. **ASEAN strip** went vertical-column on mobile (CSS) — when 9 cities are loaded that's ~270 px of stacked rows above the bottom-strip, dominating the bottom of the screen.

## What changed

### `src/index.css`

- **Topbar (≤ 767 px):** tighter gap and padding, smaller wordmark font (11 px / 0.10 em letter-spacing instead of 14 px / 0.18 em), hide the `topbar-divider`, hide `topbar-vpm-label`, hide `topbar-cmdk` (Cmd+K is keyboard-only — useless on touch). Tighter `topbar-mode-btn` letter-spacing.
- **Topbar (≤ 380 px — iPhone SE / small Androids):** drop wordmark to 10 px / 0.08 em; compress peek font to 9 px.
- **HUD (≤ 767 px):** hide the two bottom corner brackets so they don't sit on top of the freshness panel and peek strip.
- **TimeScrubber (≤ 767 px):** drop the 5-button tick row, slimmer padding. Height goes from ~72 px to ~51 px.
- **AlertPanel (≤ 767 px):** becomes a fixed bottom drawer. `transform: translateY(100%)` by default → out of viewport. When `.alert-panel--mobile-open` is added, transitions to `translateY(0)` over 320 ms (respects `prefers-reduced-motion`). Height 82 dvh, leaves ~152 px of map + topbar visible above so the user can dismiss by tapping the backdrop.
- **Alert peek (new — visible only ≤ 767 px):** a fixed strip above the bottom-strip showing `● CITY BRIEF · HH:MM | N ALERTS ▴`. Full-width tap target (≥ 44 px). The dot colour matches the overall risk level (same colour as the panel's status thread).
- **Drawer backdrop (new — only when open):** semi-opaque overlay covering the viewport above the drawer. Tap to close.
- **Drawer close (✕) (new — only ≤ 767 px):** sits in the drawer's header next to the time.
- **ASEAN strip (≤ 767 px):** stays a single row, scrolls horizontally instead of stacking vertically. Bottom position moved to clear the bottom-strip + peek strip.
- **Freshness panel (≤ 767 px):** repositioned to clear bottom-strip + peek + ASEAN.
- **Layer FAB (≤ 767 px):** moved from `top: 56 px` to `top: 74 px` so it clears the HUD telemetry ribbon properly.

### `src/components/AlertPanel.tsx`

- Added `mobileOpen` state.
- Rendered three new mobile-only elements (CSS scopes them to ≤ 767 px):
  - `<button class="alert-peek">` — opens the drawer.
  - `<div class="alert-drawer-backdrop">` — closes the drawer.
  - `<button class="alert-drawer-close">` inside the drawer header — closes the drawer.
- Added `aria-expanded` to the peek and `aria-label`s to peek and close.
- Hoisted `overallColor` and `alertCount` for re-use in the peek.

### `package.json`

- `0.5.0` → `0.5.1`.

## What was deliberately left alone

- **No data, geospatial, or map-tile changes.** Layers, Turf usage, MapLibre config, tile sources, AlphaEarth, GISTDA, NASA FIRMS, Open-Meteo, TMD, GDELT, Traffy — all untouched.
- **No visual / brand changes.** Amber `--amber` still the only accent. Hairline borders. Zero border-radius. No gradients. No drop shadows. Three-size typography respected (display 32 px / body 14 px / micro 11 px).
- **No new dependencies.** Pure CSS + a single `useState` in a component that already uses many `useState`s.
- **No editorial copy edits** on the brief, the aphorism, or any source label.
- **Desktop layout (≥ 768 px) untouched.** Verified at 768 × 1024 — peek hidden, side rail and AlertPanel render as before.
- **District panel and command palette mobile behaviour unchanged.** They already had reasonable mobile rules.
- **HUD telemetry ribbon overflow** (`white-space: nowrap; overflow: hidden`) preserved as-is — the data ticks fading off the right edge are intentional. The ribbon itself fits the viewport (`width: 100%`); only the contents extend.

## Known mobile issues not fixed in this pass

- **TimeScrubber slider on a 360–390 px viewport** is functional but cramped. A 24-step range slider on ~300 px effective width gives ~12 px per hour — usable, but not delightful. Touch-precision is a content-design problem (24 hours is the right granularity for what this represents), not a CSS fix. Flagging only — not in scope for tonight.
- **Layer FAB sheet on mobile in ANALYST mode** opens as a 60 dvh bottom sheet (existing behaviour). It works but the sources grid (`grid-template-columns: 1fr 1fr`) gets tight on very narrow phones. Not regressed by this pass.
- **Anomaly pin callouts** are 240 px wide and absolutely positioned — on a 320 px viewport with a pin near the right edge, the callout can extend past the viewport. Not regressed; pre-existing.

## Verification performed

- TypeScript: `tsc -b` clean.
- Build: `vite build` clean. Bundle size unchanged (1.0 MB / 286 KB gzipped — CSS +5 KB for the new mobile rules).
- Preview server: tested at 320×568, 360×800, 390×844, 768×1024.
- Body overflow (scrollWidth vs innerWidth): no horizontal overflow at any of the four viewports.
- Topbar overflow: 0 (was 107 px at 390 px viewport).
- Drawer open/close: state transitions correctly, animation respects reduced-motion.
- Mode switch (SIT ROOM ↔ ANALYST) on mobile: alert peek hides when not in governor mode (because AlertPanel is not mounted) and Layer FAB appears in analyst mode at top-right (44 × 44 tap target, clears HUD ribbon).
