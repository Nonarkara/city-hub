# Session — 2026-05-27 · The Civic Intelligence Push

*Non went to bed at 02:00 ICT with this brief: "Start with a big picture, plan well first, make it surprisingly amazing, make it seamless, make it snappy. Make it useful for people who need support. Show how, once we put data side by side, we see different information that we otherwise wouldn't. Aerosol satellite image telling us where the bombs landed because the carbon pattern persists. Floodplains telling us why the flood happened, not just that it did. Historical data showing how to predict and prepare, rather than be hit and face death and regrets."*

Hands-off until morning. Four hours.

---

## The big picture

Up to v0.8.0 the dashboard is a **structured data display**. It tells you what's true. The leap Non is asking for is to make it a **pattern-revealing instrument** that tells you *what's true that nobody else can see, because nobody else stacks these layers together*.

Three user journeys it has to serve:

1. **A newcomer being introduced to the city.** Tourist, journalist, diplomat, expat. Lands on the tab and gets a 30-second story that orients them — geography, climate, current state, what's distinct about this city right now. They leave knowing the city better than 99% of visitors.

2. **An analyst stacking layers to see what no single dataset shows.** Researcher, urban planner, accountability reporter. Pulls aerosol on top of historical event markers and notices that the aerosol pattern is still anchored to bombing targets 80 years later. Pulls Traffy complaints on top of BMA flood zones and sees that the official flood polygon is missing 60% of where citizens actually drowned. The dashboard surfaces these *because the geometry is doing the work*, not because we wrote rules.

3. **A city operator predicting tomorrow rather than reacting today.** Governor's chief of staff at 06:00 reads a brief that says "Based on the seasonal pattern, AQI will breach 100 within 36 hours with 80% confidence. Last time this happened: 18 March. School advisory was issued 4 hours late. Recommend issuing now." UNL has zero offering here. They sell tiles. We sell foresight.

These three journeys translate into three concrete additions to City Hub. Plus per-city open data depth across the 5 cities, in their own languages and from their own portals.

---

## What ships in four hours

### Phase 1 (90 min) — Layer Stacker + Insight Templates · *"see what no single layer shows"*

The single most differentiated addition. Six pre-configured layer stacks, each with a one-paragraph explanation of what hidden pattern it reveals:

1. **AEROSOL AS WITNESS** — NASA MODIS aerosol optical depth + historical events GeoJSON (Allied bombing of Bangkok 1942–45 + post-1945 industrial accidents). Pattern: aerosol concentration persists at carbon-saturated sites for decades.
2. **WHY THIS FLOOD HAPPENED** — GISTDA historical floods + Traffy citizen flood reports + BMA canal layer + Open-Meteo recent rainfall. Pattern: official flood polygon vs citizen reports reveals where official monitoring fails.
3. **NIGHT LIGHTS = WEALTH GRADIENT** — VIIRS Black Marble + GHSL population + district risk. Pattern: dark population centres = under-served districts.
4. **NARRATIVE VS REALITY** — PM2.5 + GDELT news tone + Traffy heatmap. Pattern: where citizens scream but the press is silent.
5. **FIRES + DOWNWIND POPULATION** — NASA FIRMS + Open-Meteo wind vector + population density. Pattern: who breathes the smoke.
6. **HEAT ISLANDS** — MODIS land surface temperature + 3D buildings + GHSL population. Pattern: where the city physically retains heat the worst.

A new top-right "INSIGHT" button opens the stack menu. Click a template → multiple layers activate at once with pre-tuned opacities. Each layer in the LayerRail gets an opacity slider so analysts can stack their own.

### Phase 2 (45 min) — City Onboarding · *"introduce me to this city in 30 seconds"*

When the user clicks a city tab:
- **Smooth fly animation** with two stages: zoom out → fly across → zoom in. Already partial, made cinematic.
- **City Quick Facts card** appears in the upper-left during fly: name in local language, founding date, area, population, climate band, current AQI/weather snapshot, the city's one-line distinctiveness ("Phuket — Thailand's largest island, tin-mining past, 9.9M visitors per year").
- **Pre-fetch on hover** — hovering a tab starts the next city's fetches so click→render is instant.

### Phase 3 (90 min) — Per-city deep open data · *"get to the deepest level open data can do"*

Research and wire **at least one new local-language open data source per city**, drawing from each city's own government portal. The Bangkok side is already deep (BMA, Air4Thai PCD, Traffy, TMD, GISTDA). The other four need raising.

- **Bangkok** — already deep. Add ดวงดาว (NSDC Smart City programme indicators) if accessible.
- **Chiang Mai** — wire CMU air quality network (`cmuccdc.org`), Northern Thailand burning season alerts (DEQP).
- **Phuket** — wire Phuket Provincial Admin Office portal + TAT tourism arrivals + marine vessel arrivals (`marinetraffic.com` open feed where possible).
- **Singapore** — wire `data.gov.sg` (the largest open-data portal in the region, JSON, no key, CORS-friendly) + LTA DataMall (transit) + NEA PSI air quality.
- **Kuching** — wire Sarawak Open Data Portal + Department of Statistics Malaysia local data + JUPEM (mapping).

Add an **Open Data Inventory** panel per city showing all active sources with their freshness — proof of how much is already public when someone bothers to integrate it.

### Phase 4 (15 min) — Polish + ship

Build, push, deploy, screenshot each city, document what shipped.

---

## What the morning brief should look like for the user

When Non opens the dashboard, the difference should be obvious in 10 seconds:

1. **The city he lands on tells him a story he didn't already know.** Quick facts card surfaces something specific (e.g. for Bangkok, the strongest pillar from SLIC, today's anomaly, the most-reported civic issue type).
2. **There's an INSIGHT button in the upper-right that wasn't there before.** Clicking it opens six pre-configured pattern reveals. He clicks "AEROSOL AS WITNESS" and sees MODIS aerosol over Bangkok with red dots marking the 1942–45 bombing targets. He drags the opacity slider on the aerosol layer down to 50% to compare against the historical markers underneath. He sees the correlation.
3. **He switches to Singapore.** Fly animation is fast. Quick facts card updates instantly. The OPEN DATA INVENTORY panel shows him: data.gov.sg connected, LTA DataMall connected, NEA PSI connected — eight sources active, all from local government, no third-party platform required.
4. **He scrolls down on Chiang Mai's panel.** CMU air quality network has stations that GISTDA doesn't. Northern burning season alerts from DEQP are surfaced. He sees that Chiang Mai has more local-source coverage than UNL ever offered.
5. **He flips Bangkok back on and looks at the SLIC structural panel.** The radar he already has. But now there's a new section under it: "PREDICT-AND-PREPARE" — a 7-day probability statement grounded in the seasonal pattern + forecast + SLIC weakness.

That's the morning. Five things, all visible without scrolling.

---

## What I'm explicitly NOT doing tonight

- A custom Mapbox Studio style (Bauhaus-tighter than the default). Future.
- A full AI co-pilot chat panel. Tomorrow night's project — non69's `ChatInterface.tsx` is ready to lift.
- 3D Deck.gl extrusion (population towers, civic-issue hexagon binning). Lift from geopolitics tomorrow.
- Geocoding search bar. Tomorrow.
- True historical time-travel scrubbing (30-day rewind). Needs Supabase ingestion of historical snapshots; tomorrow.
- Anything UNL-related on the existing repo. Their account closure is Non's hand.

---

## How to read the result in the morning

Live URL: [city-hub.pages.dev](https://city-hub.pages.dev)
GitHub: [github.com/Nonarkara/city-hub](https://github.com/Nonarkara/city-hub)

Each phase will land as its own commit so the morning git log reads like a chapter list.

Non — ทุกอย่างเกิดขึ้นเพราะมีเหตุ. Sleep well. The city will be brighter in the morning.
