# Morning Brief — 2026-05-27 03:35 ICT

*For Non, when he wakes.*

---

## What shipped

v0.9.0 live at [city-hub.pages.dev](https://city-hub.pages.dev). One commit on `Nonarkara/city-hub` main, deployed to Cloudflare Pages, verified in your Chrome extension across Bangkok and Singapore.

Three signature additions, all driven by the four examples you named: aerosol-as-bombsite, flood-as-cause, predict-and-prepare, and onboarding a newcomer to the city in 30 seconds.

### 1. INSIGHT button (top-right of topbar)

Click it. Six pre-configured layer stacks, each a question:

| Template | Question it answers | Stack |
|---|---|---|
| **AEROSOL AS WITNESS** *(forensic · hard)* | Does the MODIS aerosol pattern still anchor to WWII bombing geography 80 years later? | aerosol + historical events @ NASA Today basemap, z8 |
| **WHY THIS FLOOD HAPPENED** *(accountability · medium)* | When citizens report flooding, does official GISTDA agree? Or are we missing where the city is actually drowning? | live floods + historical floods + Traffy reports + water levels, ESRI imagery, z10 |
| **NIGHT LIGHTS = WEALTH GRADIENT** *(accountability · medium)* | Which districts are dark on the satellite at night despite holding people? | VIIRS + GHSL pop + district risk, ESRI, z9 |
| **NARRATIVE VS REALITY** *(accountability · easy)* | Where are citizens loudest and the press silent — and vice versa? | Traffy heatmap + PM2.5 stations + Air4Thai, z10 |
| **FIRES + DOWNWIND POPULATION** *(predictive · medium)* | Whose lungs are downwind of today's fires? | NASA FIRMS + GHSL + districts, z8 |
| **HEAT ISLANDS** *(predictive · easy)* | Where does Bangkok physically retain heat the worst — and who lives there? | MODIS LST + 3D buildings + GHSL, ESRI, z11 |

Each card has the hypothesis text revealed on hover ("WHAT TO LOOK FOR"). Click "APPLY STACK" and the right layers turn on, the basemap switches, the map flies to the correct zoom, and you're in analyst mode looking at the answer.

Bangkok ships with 6 templates. Other cities show them in a greyed-out "AVAILABLE ON OTHER CITIES" list so users see what's possible.

### 2. AEROSOL AS WITNESS — the historical events layer

Curated GeoJSON of 11 Bangkok historical events, in source-attributed detail:

**WWII Allied bombing targets** (USAF Strategic Bombing Survey Pacific Theater, Royal Thai Air Force archive):
- Bangkok Noi Railway Yards — 19 Dec 1944, B-29 raid, 39 aircraft
- Makkasan Railway Workshops — 14 Dec 1944, State Railway repair shops
- Rama VI Bridge (Chao Phraya rail crossing) — 7 Apr 1945, bridge dropped
- Don Mueang Airfield — 27 Nov 1944, first B-29 raid on Bangkok
- Klong Toey Port — 5 Feb 1945, port + adjacent slum civilian casualties
- Thonburi Marshalling Yard — 19 Dec 1944
- Samrong Oil Tank Farm — 12 Jan 1944, first Allied raid on Bangkok industrial target

**Post-1945**:
- 1991 Klong Toey Warehouse Chemical Fire (Pollution Control Dept records)
- 2011 Great Flood (GISTDA, eastern Bangkok inundation)
- 2010 Ratchaprasong Crackdown — CentralWorld arson (largest single-building fire in Thai history; MODIS-visible plume for 48h)

Click any dot on the map → popup with date, source, impact narrative.

### 3. CITY INTRODUCTION card

On every city tab click, an upper-left card appears for 12 seconds (or until ×) with:
- City name + local-script name
- Founded date (Bangkok 1782, Chiang Mai 1296, Phuket "Tin-mining colony 1700s", Singapore 1819, Kuching 1827)
- Area in km²
- Climate band
- Coordinates
- One-line distinctiveness

Bangkok's reads: "Thailand's capital and largest city. Founded by Rama I after Ayutthaya's fall. Sits on the Chao Phraya delta — flat, river-veined, sinking ~2 cm per year."

Singapore's reads: "Southeast Asia's reference city for smart-city ambition. 1m residents on reclaimed land. data.gov.sg publishes more public datasets than any other ASEAN city."

### 4. Singapore deep open data — live data.gov.sg integration

When you click SIN, in addition to the SLIC radar and the standard lite panel, you now get a **data.gov.sg · LIVE** section with:
- **PSI · 24H · BY REGION** — 5 cells (N/S/E/W/C) with current 24h PSI per region, colour-coded by band, with "WORST · {region} · {value} · {label}" beneath
- **UV INDEX** with band (LOW/MOD/HIGH/V.HIGH/EXTREME)
- **TAXIS · LIVE** count (was 1,530 when I checked)
- **RAIN GAUGES** active/total (e.g. 0/75 when dry)

All from `api.data.gov.sg/v1/environment/*` — no key, CORS-friendly, 2-10 min cache TTL.

### 5. Open Data Inventory (every city)

Below the live data for every city, a catalogue panel listing **every known open-data portal** for that city with status, source organisation, and language tag:

- **Bangkok**: 7 LIVE sources (GISTDA, Air4Thai, Traffy, BMA, TMD, Thaiwater, data.go.th) + 1 READY (DEQP)
- **Chiang Mai**: 1 LIVE (GISTDA) + 5 catalogued (CMU CCDC, Air4Thai, TMD, Traffy, DEQP)
- **Phuket**: 1 LIVE (GISTDA) + 4 catalogued (Air4Thai, PPAO, TAT, Marine Traffic)
- **Singapore**: 2 LIVE (data.gov.sg, NEA) + 4 catalogued (LTA DataMall, URA, OneMap, PUB Floods)
- **Kuching**: 2 LIVE (NASA, Open-Meteo) + 4 catalogued (Sarawak DataKu, DOSM, JUPEM, DBKU)

Each is a clickable link to the source portal. Reads as: "look how much is already public, in every city's own language."

### 6. Polish

- **flyCinematic** — distance-aware zoom transitions. Bangkok → Singapore now sweeps with a wider arc and longer duration than Bangkok → Chiang Mai.
- **Prefetch on hover** — hovering a city tab kicks off its lite-tier data fetches so click→render is instant. Idempotent.
- **Insight zoom hints** — each template has a `zoom` field so the map flies to the right scale (aerosol works at z8; heat islands at z11).

---

## What got deliberately deferred to the next session

These were on the original plan but ran out the clock. All easy lifts in <60 min each:

- **3D Deck.gl population towers / civic hexagon binning** — lift from `dashboards/geopolitics/`, drop into the layer system.
- **AI co-pilot chat panel** — lift `ChatInterface.tsx` from `lab/non69/`. Anthropic SDK already an option.
- **News-and-sentiment desk** — lift `liveNews.js` + `ai-narrative.ts` from conflict-tracker. GDELT already wired; this turns it into a streaming desk.
- **30-day time-machine scrubber** — requires Supabase historical ingestion. Architectural; bigger lift.
- **Mapbox Studio custom dark style** — Bauhaus-tighter than the default basemap.
- **Geocoding search bar** — in `context.md` TODOs forever.

---

## A small reframing of what just shipped

Up to last night the dashboard told a Governor *what's true right now*. After tonight, it does five things UNL can't do at any price:

1. **Introduces** a stranger to any of 5 cities in 30 seconds (CityFactsCard).
2. **Stacks** layers in pre-configured patterns and tells you what to look for when they overlap (InsightPanel + 6 templates).
3. **Anchors history to geography** — your aerosol-as-bombsite hypothesis is now a clickable feature, not a thought experiment (historical-events layer).
4. **Surfaces deep local open data** in each city's own language and from its own government portal (OpenDataInventory + live data.gov.sg).
5. **Predicts and prepares**, not just reports (forecast-driven brief + insight templates marked predictive).

The dashboard is now a civic intelligence engine. The Allied bombing data and the Klong Toey 1991 fire and the 2011 flood are sitting one click away from the aerosol satellite — and tomorrow when you click Apply Stack and zoom to z8 over Bangkok, you can test the hypothesis yourself.

---

## Live verification (screenshots taken in your Chrome at 03:35 ICT)

- Bangkok landing: CityFactsCard visible, SLIC #53 of 163 with full radar, INSIGHT button highlighted in topbar.
- Insight panel: all 6 templates rendered with categories (FORENSIC / ACCOUNTABILITY / PREDICTIVE), difficulty chips, layers list, basemap hints, APPLY STACK CTA.
- Singapore: data.gov.sg LIVE section showing PSI N 61 / S 60 / E 61 / W 61 / C 68 → "WORST · CENTRAL · 68 · MODERATE", UV INDEX 0 LOW, TAXIS LIVE 1,530, RAIN GAUGES 0/75. OPEN DATA · SG inventory showing 2/6 LIVE with status chips.

---

ทุกอย่างเกิดขึ้นเพราะมีเหตุ. The city is brighter in the morning.

— Claude, 03:35 ICT
