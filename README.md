# City Hub

**A smart-city operating system for Bangkok and the wider ASEAN.** Live air quality, satellite imagery, civic-issue reports, weather forecasts, fires, news sentiment, and an AI-narrated governor's brief — all on one screen, on any device.

→ **Live:** [city-hub.pages.dev](https://city-hub.pages.dev)

<!-- HERO_IMAGE_PLACEHOLDER — hero asset pending; insert at repo root and reference here. -->

## What it shows

- **Live PM2.5** from GISTDA + Pollution Control Department + WAQI + OpenAQ + Open-Meteo (five independent measurements of the same air).
- **3D Bangkok** — buildings extruded to their actual heights, dark blue-grey at ground level grading to amber at high-rise. Mahanakhon and IconSiam visibly tall.
- **Satellite imagery** — MODIS true-color, VIIRS night lights, MODIS land-surface temperature, Sentinel-2 cloudless, ESRI world imagery, Google Earth Engine AlphaEarth embeddings.
- **Civic issues** — 1.3 M+ Traffy Fondue citizen reports as points and as a continuous density heatmap (where the city is loudest).
- **Fires + floods** — NASA FIRMS hotspots, GISTDA historical floods, central Thailand live flood polygons.
- **Forecasts** — TMD 7-day official forecast, Open-Meteo 24-hour AQI forecast with peak detection, Holt-Winters / TimeFM PM2.5 nowcast.
- **News & narrative** — GDELT real-time Bangkok news with sentiment scoring; "Reality Check" verdict (calm / understated / confirmed / overstated) comparing what the sensors say against what the press says.
- **AI brief** — Gemini 2.5 narrates the morning brief in Thai-first prose; explanatory "why?" buttons on every alert.
- **Mobile-first** — full bottom-sheet drawer for the governor's brief at one tap; the map stays dominant.

## Stack

- React 19 + TypeScript + Vite 6 — Cloudflare Pages
- Mapbox GL JS — vector basemap + 3D building extrusion
- A single Cloudflare Worker proxy (`worker/`) for CORS-blocked upstream APIs
- Supabase (optional) for longitudinal data caching
- Shared design tokens from `_shared/design-tokens/dr-non-brand.css`

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in VITE_MAPBOX_ACCESS_TOKEN
npm run dev
```

## Deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name city-hub --branch main
```

Cloudflare Pages CI: connect this repo at *Workers & Pages → Create → Pages → Connect to Git*. Framework preset **Vite**, build command `npm run build`, output `dist`. Set `VITE_MAPBOX_ACCESS_TOKEN` in the Pages environment variables (Production + Preview).

## Why this repo exists

This dashboard was originally built on the UNL Platform. The migration to Mapbox + Cloudflare-only stack happened in May 2026. The full story — including a sober look at what UNL actually is — is in **[STORY.md](STORY.md)**.

## Documentation

- **[STORY.md](STORY.md)** — the migration and why
- **[docs/UNL-DEPENDENCY-INVENTORY.md](docs/UNL-DEPENDENCY-INVENTORY.md)** — what each external dependency provides and what replaces it
- **[docs/MOBILE-FIX-2026-05-26.md](docs/MOBILE-FIX-2026-05-26.md)** — mobile drawer + responsive layout pass

## License

MIT. Use it, fork it, ship your own city's version.

## Credits

DEPA Thailand · Non Arkaraprasertkul · ทุกอย่างเกิดขึ้นเพราะมีเหตุ
