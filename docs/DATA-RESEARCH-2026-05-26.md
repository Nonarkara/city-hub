# Deep Research: Hidden & Untapped Data Sources for Bangkok City Dashboard

> Research date: 2026-05-26
> Goal: Find 10x more information layers to transform the UNL City Hub from "good dashboard" into "irreplaceable city intelligence system"

---

## Executive Summary

The current UNL City Hub already has 22 map layers and 18 data sources. To reach "world-class, Claude-could-never-build-this" status, we need to add **7 new major data categories** with **20+ new data sources**, plus **4 analytical capabilities** that transform raw data into actionable intelligence.

The gap between "map with pins" and a governor's situation room is: **context, correlation, predictability, and actionability**.

---

## Tier 1: Implement Immediately (Highest Impact + Feasible)

### 1. Real-Time Traffic Flow (Currently MISSING — Huge Gap)

**Why it matters:** The dashboard has Traffy complaints about traffic, but NO actual traffic speed/congestion data. This is like having a doctor who only knows patients complained of pain, but has no thermometer.

**Source: TomTom Traffic API**
- **Free tier:** 2,500 transactions/day
- **Endpoints:**
  - Flow: `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={KEY}&point={LAT},{LNG}`
  - Incidents: `https://api.tomtom.com/traffic/services/5/incidentDetails?key={KEY}&bbox={SW_LAT},{SW_LNG}:{NE_LAT},{NE_LNG}`
  - Area Analytics: Free CSV download for Bangkok congestion index
- **Data:** Real-time speed, free-flow speed, confidence, road closures, accidents, construction
- **Bangkok Traffic Index:** https://www.tomtom.com/traffic-index/city/bangkok — historical congestion data

**Source: HERE Traffic API**
- Commercial but has trial. Better incident coverage in Southeast Asia.

**Visualization:**
- Color-coded road segments (green/yellow/red) overlaid on the map
- Traffic incident pins (accidents, construction, road closures)
- Congestion index KPI card
- Historical trend: "Bangkok congestion is 15% worse than last Monday"

---

### 2. Official PCD Air Quality (Air4Thai) — Credibility Layer

**Why it matters:** Current dashboard uses GISTDA + Open-Meteo + WAQI. Missing the **official Thai government source** — Pollution Control Department. This is what the BMA and Ministry of Public Health actually use.

**Source: Air4Thai (PCD Thailand)**
- **Endpoint:** `http://air4thai.pcd.go.th/services/getNewAQI_JSON.php`
- **By region:** `?region=1` (Bangkok & metro)
- **By station:** `?stationID={ID}`
- **Data:** PM2.5, PM10, O3, CO, NO2, SO2, AQI, lat/lng, last update
- **Stations:** 77+ across 46 provinces, ~15 in Bangkok metro
- **Access:** Public, no API key
- **Rate limits:** Undocumented, cache aggressively

**Additional: OpenAQ**
- **Endpoint:** `https://api.openaq.org/v3/measurements?countries=TH`
- **Nonprofit global aggregator** — harmonizes PCD + other sources into uniform format
- **No API key required**

**Visualization:**
- PCD station circles (distinct color from GISTDA — shows multi-source validation)
- "Official vs. Satellite" comparison panel
- NO2/SO2/CO breakdown (these pollutants indicate traffic/industrial sources, not just dust)

---

### 3. BMA Real-Time Flood Monitoring (Reverse-Engineered)

**Why it matters:** Bangkok floods. The dashboard has historical flood zones and Traffy flood complaints, but NO real-time water levels, rainfall, or pump status. This is the difference between "it flooded last year" and "it will flood in 2 hours."

**Source: BMA Flood Monitoring (`flood.bangkok.go.th`)**
- The public web app exposes internal JSON APIs
- **Rainfall:** City rain gauge network + C-band radar calibrated data
- **Canal/river water levels:** Real-time from sensors
- **Road water levels:** Critical road sensors
- **Pumping station status:** On/off, capacity
- **2-hour nowcasts:** 500m-cell rainfall prediction maps
- **Access:** Reverse-engineered from frontend XHR requests. Wrap in Worker with aggressive caching.

**Source: Thaiwater.net (National Hydroinformatics)**
- **URL:** `https://www.thaiwater.net/`
- **Data:** Rainfall, water level, temperature, flood, water quality (pH, DO, conductivity, turbidity, salinity)
- **Multi-agency integration:** TMD, RID, BMA, DDPM

**Source: GISTDA Disaster Platform**
- **URL:** `https://disaster.gistda.or.th/services/open-api`
- **Real-time flood, wildfire, drought JSON API**
- **Satellite-derived flood extent**

**Visualization:**
- Real-time water level gauges on canals/roads
- Rainfall radar overlay (animated)
- Pump station status icons
- Flood risk prediction layer ("High risk in Khlong Toei in next 2 hours")
- Combined: Rainfall + Canal level + Pump status + Traffy flood complaints = predictive flood model

---

### 4. Infrastructure & Critical Facilities (OSM + Official)

**Why it matters:** When something goes wrong (flood, fire, air emergency), you need to know where hospitals, fire stations, police, and shelters are. Currently missing entirely.

**Source: OpenStreetMap (Overpass API)**
- **Hospitals:** `node["amenity"="hospital"]`
- **Fire stations:** `node["amenity"="fire_station"]`
- **Police stations:** `node["amenity"="police"]`
- **Schools:** `node["amenity"="school"]`
- **Markets:** `node["amenity"="marketplace"]`
- **Pharmacies:** `node["amenity"="pharmacy"]`
- **Gas stations:** `node["amenity"="fuel"]`
- **Banks/ATMs:** `node["amenity"="bank"]` / `node["amenity"="atm"]`
- **Bangkok bbox:** lat 13.50-13.95, lon 100.35-100.95
- **Access:** Free, no key

**Source: BMA data.bangkok.go.th**
- Fire station locations dataset
- Hospital locations dataset
- School locations dataset

**Source: Overture Maps (Meta/Microsoft/Amazon)**
- **URL:** `https://overturemaps.org/`
- **Much richer POI data than OSM** — 59M places globally
- **Available as GeoParquet/GeoJSON** via AWS S3
- **Bangkok coverage:** Excellent for commercial POIs

**Visualization:**
- Toggleable infrastructure layers (hospitals, fire, police, schools)
- Icon-coded pins with capacity info where available
- "Emergency response" overlay — shows nearest facilities to any incident
- Heatmap of healthcare access gaps

---

### 5. Tourism & Short-Term Rental Density (Inside Airbnb)

**Why it matters:** Airbnb density is a proxy for tourism pressure, housing affordability crisis, and neighborhood character change. No current dashboard shows this.

**Source: Inside Airbnb**
- **Listings:** `http://data.insideairbnb.com/thailand/central-thailand/bangkok/{DATE}/visualisations/listings.csv`
- **GeoJSON:** `.../visualisations/neighbourhoods.geojson`
- **Latest:** 2025-06-24
- **Data:** ~20,000 listings with lat/lng, price, room type, reviews, availability, host listings count
- **Access:** Free, no key

**Visualization:**
- Airbnb listing density heatmap
- Price-per-night choropleth by neighborhood
- "Tourism pressure" index (listings + reviews per km²)
- "Housing pressure" flag (high availability + high host listing count = commercial operator)

---

### 6. Earthquake & Seismic (TMD)

**Why it matters:** Thailand has seismic risk. The 2025 Myanmar earthquake was felt in Bangkok. Early warning saves lives.

**Source: TMD Earthquake API**
- **Endpoint:** `https://data.tmd.go.th/api/DailySeismicEvent/v1/`
- **Data:** Magnitude, depth, location, time (Thai + regional)
- **Access:** Free, no key

**Visualization:**
- Seismic event pins (size = magnitude, color = depth)
- "Felt in Bangkok" filter
- Historical seismic risk zones

---

### 7. Water Quality (Thaiwater + BMA)

**Why it matters:** Chao Phraya water quality, canal pollution, and industrial discharge are critical for Bangkok but completely invisible in current dashboard.

**Source: Thaiwater.net**
- pH, dissolved oxygen, conductivity, turbidity, temperature, salinity
- Multiple monitoring stations in Bangkok canals

**Source: BMA data.bangkok.go.th**
- Canal water quality datasets

**Visualization:**
- Water quality gauge stations on canals
- Color-coded by WQI (Water Quality Index)
- Trend arrows (improving/degrading)

---

## Tier 2: High Impact, Medium Effort

### 8. Sentinel-5P Air Quality (Copernicus)

**Why it matters:** Current air quality is point-based (station data). Sentinel-5P provides **city-wide satellite-derived** NO2, SO2, CO, formaldehyde, ozone, and aerosol — showing pollution sources, not just concentrations.

**Source: Copernicus Atmosphere Monitoring Service (CAMS)**
- **URL:** `https://atmosphere.copernicus.eu/`
- **API:** `https://ads.atmosphere.copernicus.eu/api/`
- **Data:** NO2, SO2, CO, O3, PM2.5, PM10, AOD forecasts
- **Coverage:** Global, including Bangkok
- **Access:** Free registration

**Source: Google Earth Engine — Sentinel-5P**
- `COPERNICUS/S5P/OFFL/L3_NO2`
- `COPERNICUS/S5P/OFFL/L3_SO2`
- `COPERNICUS/S5P/OFFL/L3_CO`
- Already have Earth Engine integration! Just add new collections.

**Visualization:**
- NO2 column density map (traffic/industrial indicator)
- SO2 map (industrial/power plant indicator)
- CO map (burning/vehicle indicator)
- Temporal animation showing daily/weekly patterns

---

### 9. NASA GPM IMERG Precipitation

**Why it matters:** Rain gauges are point measurements. GPM IMERG provides **satellite-derived rainfall estimates** for every 0.1° grid cell, every 30 minutes. Much better for flood prediction.

**Source: NASA GPM IMERG**
- **URL:** `https://gpm.nasa.gov/data/imerg`
- **Earth Engine:** `NASA/GPM_L3/IMERG_V06`
- **Resolution:** 0.1° × 0.1°, 30-minute intervals
- **Latency:** 12 hours (final), 4 hours (late), 30 min (early)

**Visualization:**
- Animated rainfall accumulation map
- "Rainfall in last 24h" choropleth by district
- Correlation with flood complaints ("Complaints spike 2h after >30mm rain")

---

### 10. Population Density & Built-Up Areas

**Why it matters:** All environmental metrics need per-capita context. PM2.5 in a dense district is worse than same level in sparse district.

**Source: WorldPop (University of Southampton)**
- **URL:** `https://www.worldpop.org/`
- **Thailand 2020:** 100m resolution population grid
- **Access:** Free download

**Source: GHSL (Global Human Settlement Layer)**
- **URL:** `https://ghsl.jrc.ec.europa.eu/`
- **Built-up areas, population density, settlement layers**
- **Earth Engine:** `JRC/GHSL/P2023A/GHS_BUILT_S`

**Source: World Settlement Footprint 3D**
- **Building heights and volumes** for Bangkok

**Visualization:**
- Population density choropleth (district level)
- Built-up area overlay
- "Exposure" calculations: PM2.5 × population = people affected
- "Vulnerability" index: flood risk × population density × elderly %

---

### 11. Road Accidents (Thai RSC)

**Why it matters:** Traffic safety is a top Bangkok issue. 20,000+ deaths/year nationally. Hotspot identification saves lives.

**Source: Thai RSC (Road Safety Center)**
- **URL:** `https://www.thairsc.com/`
- **Data:** 24-hour accident notifications with location
- **Access:** Public website, may need scraping

**Source: Ministry of Transport data portal**
- **URL:** `https://datagov.mot.go.th/en/dataset/roadaccident`
- **Requires registration**

**Visualization:**
- Accident hotspot heatmap
- Blackspot identification (intersections with 3+ accidents/year)
- Time-of-day patterns ("Most accidents at 6-8pm")

---

### 12. Economic Indicators (Bank of Thailand)

**Why it matters:** City health isn't just environmental — it's economic. Tourism, investment, construction activity.

**Source: Bank of Thailand API**
- **URL:** `https://www.bot.or.th/`
- **Data:** Exchange rates, interest rates, credit, tourism statistics
- **Access:** Free registration

**Source: NSO (National Statistical Office)**
- **Via data.go.th:** Population, GDP, employment by district

**Source: Google Environmental Insights Explorer**
- **URL:** `https://insights.sustainability.google/`
- **Bangkok data:** Building emissions, transport emissions, rooftop solar potential, tree canopy
- **Access:** Free for government (sign up)

**Visualization:**
- Economic health KPIs
- Tourism index (Airbnb + hotel data)
- Construction activity permits
- Carbon emissions by sector

---

### 13. Noise Pollution (Estimated)

**Why it matters:** Bangkok is one of the noisiest cities in the world. No current data.

**Source: OSM + Traffic proxy**
- Major road proximity as noise proxy
- Airport flight paths (DMK, BKK)
- BTS/MRT noise corridors

**Source: Barcelona-style IoT (future)**
- Sentilo platform for noise sensors
- Not currently available for Bangkok

**Visualization:**
- Estimated noise level contour map
- Quiet zone identification (parks, residential away from highways)
- Complaint correlation: noise complaints vs. proximity to major roads

---

## Tier 3: Analytical Capabilities (The "10x" Multiplier)

Data alone isn't enough. World-class dashboards provide **intelligence** — answers, not just information.

### 14. Predictive Flood Model (Rule-Based)

**Inputs:**
- Rainfall (GPM IMERG + TMD gauges + BMA radar)
- Canal water levels (Thaiwater + BMA)
- Pump station status (BMA)
- Tide levels (Chao Phraya estuary)
- Historical flood zones (GISTDA)
- Ground elevation (SRTM/ASTER)

**Model:**
```
IF rainfall_1h > 30mm AND canal_level > 80% AND pumps < 50% capacity
THEN flood_risk = HIGH in low_elevation_districts
```

**Output:**
- 2-hour flood risk prediction by district
- Priority alert: "Khlong Toei: HIGH flood risk in next 2 hours"
- Recommended action: "Activate pumps 3, 4, 7. Alert residents in zones A, B."

---

### 15. Correlation Engine

**Automatically discover relationships:**
- "PM2.5 spikes 3 hours after traffic congestion exceeds 70%"
- "Flood complaints increase 400% when rainfall >50mm AND pumps offline"
- "Districts with <5% green space have 2.3x higher heat index"
- "Airbnb density correlates with 18% increase in garbage complaints"

**Implementation:** Simple Pearson/Spearman correlation on time-series data, updated daily.

---

### 16. Vulnerability Index

**Composite score per district:**
```
Vulnerability = (flood_risk × population_density) 
              + (pm25_level × elderly_pct × child_pct) 
              + (heat_index × outdoor_worker_pct)
              + (traffic_accidents × school_density)
```

**Output:**
- District ranking by vulnerability
- "Most vulnerable district today: Khlong Toei (flood + air + heat)"
- Resource allocation recommendations

---

### 17. Temporal Playback

**Scrub through time for ALL layers:**
- Watch PM2.5 evolve over 7 days
- Watch flood complaints appear after rainfall
- Watch traffic congestion build and dissipate
- Watch Airbnb listings grow over months

**Implementation:** Store time-stamped data in Supabase, query by time range, animate on map.

---

## Hidden Gems Not on the Original List

### 18. LINE Official Account Data (Indirect)
- Traffy Fondue is LINE-based. 50M Thai users.
- Consider LINE Login integration for citizen reporting
- LINE Messaging API for alerts: `@unlcityhub` official account

### 19. Apify Transit Scraper
- **URL:** `https://apify.com/jungle_synthesizer/thailand-transit-scraper`
- **Cost:** ~$0.87 for full dataset
- **Data:** BTS (119 stations), SRT, ARL Red Line timetables
- **Bilingual JSON** with station catalogs

### 20. Copernicus Land Monitoring Service
- **URL:** `https://land.copernicus.eu/`
- **Urban Atlas:** High-resolution land use for Bangkok
- **Imperviousness:** Sealed surface mapping (flood risk proxy)
- **Tree Cover Density:** Green space mapping

### 21. Microsoft Planetary Computer
- **URL:** `https://planetarycomputer.microsoft.com/`
- **Free API** for Sentinel-2, Landsat, MODIS
- **STAC API** for querying satellite imagery by time/location

### 22. Facebook Data for Good (if available)
- Population density maps
- Mobility patterns
- Disaster response maps
- Check availability for Thailand

### 23. SafeGraph / Placekey (Commercial)
- POI visitation patterns
- Foot traffic analytics
- Not free but extremely valuable

### 24. Urban Heat Island (Satellite-Derived)
- **Source:** Landsat 8/9 thermal bands via Earth Engine
- **Source:** MODIS Land Surface Temperature (already have!)
- **Analysis:** Compare built-up vs. green space temperature
- **Output:** "Khlong Toei is 4.2°C hotter than Lumpini Park today"

---

## Recommended Implementation Order

### Sprint 1 (This session): Foundation
1. ✅ TomTom Traffic API — Worker proxy + map layer
2. ✅ Air4Thai PCD — Official air quality stations
3. ✅ BMA Flood reverse-engineered — Water levels, rainfall, pumps
4. ✅ OSM POIs — Hospitals, fire, police, schools
5. ✅ Thaiwater.net — Water quality
6. ✅ TMD Earthquake — Seismic events

### Sprint 2: Depth
7. Inside Airbnb — Tourism density layer
8. Sentinel-5P — NO2, SO2, CO satellite maps
9. GPM IMERG — Satellite rainfall
10. WorldPop/GHSL — Population density
11. Road accidents — Thai RSC

### Sprint 3: Intelligence
12. Predictive flood model
13. Correlation engine
14. Vulnerability index
15. Temporal playback
16. Google EIE — Emissions & solar potential

---

## Architecture Notes

### Worker Proxy Expansion
Current worker handles 8 APIs. Expand to:
- `/traffic/flow` → TomTom
- `/traffic/incidents` → TomTom
- `/air4thai` → PCD
- `/flood/bma` → Reverse-engineered BMA flood
- `/thaiwater` → Thaiwater.net
- `/earthquake` → TMD
- `/osm/pois` → Overpass API (or cache in Supabase)
- `/airbnb` → Inside Airbnb (or cache CSV in Supabase)

### Supabase Schema Expansion
```sql
-- New tables for Sprint 1
traffic_flow (segment_id, road_name, speed_kph, free_flow_speed, confidence, updated_at)
traffic_incidents (id, type, severity, lat, lng, road_name, start_time, end_time)
air4thai_stations (station_id, name_th, name_en, lat, lng, pm25, pm10, no2, so2, co, o3, aqi, updated_at)
flood_sensors (sensor_id, name, lat, lng, type, value, unit, updated_at)
earthquakes (id, magnitude, depth_km, lat, lng, location, time, felt_in_bangkok)
osm_pois (id, osm_id, lat, lng, amenity, name_th, name_en, tags)
water_quality (station_id, name, lat, lng, ph, do, conductivity, turbidity, wqi, updated_at)
```

### Rate Limiting Strategy
| Source | Cache TTL | Notes |
|--------|-----------|-------|
| TomTom Traffic | 2 min | Real-time but rate-limited |
| Air4Thai | 15 min | Official updates hourly |
| BMA Flood | 5 min | Critical during monsoon |
| Thaiwater | 30 min | Slow-changing |
| TMD Earthquake | 5 min | Events are rare but important |
| OSM POIs | 24 hours | Static data |

---

## What Makes This "10x More Useful"

| Before | After |
|--------|-------|
| "PM2.5 is high" | "PM2.5 is high, NO2 confirms traffic is the source, and 3 districts with highest elderly population are most at risk" |
| "There were flood complaints" | "Canal levels are rising, pumps are at 40% capacity, radar shows 45mm rain incoming, and Khlong Toei will likely flood in 90 minutes" |
| "Traffic is bad" | "Congestion is 23% worse than average, incident on Rama IX Rd, estimated delay 18 minutes, alternative route via Sukhumvit 71 is clear" |
| "This district has issues" | "This district has a vulnerability score of 8.2/10 — flood risk (high) × population density (very high) × elderly % (above average). Recommend: pre-position emergency supplies." |
| "Here are some data points" | "Watch how this flood event unfolded over 6 hours — rainfall → canal rise → pump activation → complaints → resolution" |

---

## Sources & References

1. **Traffy Fondue:** `https://publicapi.traffy.in.th/`
2. **GISTDA Portal:** `https://gistdaportal.gistda.or.th/`
3. **GISTDA Open Data:** `https://opendata.gistda.or.th/`
4. **GISTDA Disaster API:** `https://disaster.gistda.or.th/services/open-api`
5. **BMA Data:** `https://data.bangkok.go.th/`
6. **BMA Flood:** `https://flood.bangkok.go.th/`
7. **BMA 3D Map:** `https://3d-cpd.bangkok.go.th`
8. **Air4Thai:** `http://air4thai.pcd.go.th/`
9. **WAQI:** `https://aqicn.org/api/`
10. **OpenAQ:** `https://api.openaq.org/v3/`
11. **TMD:** `https://www.tmd.go.th/`, `https://data.tmd.go.th/api/DailySeismicEvent/v1/`
12. **TMD CKAN:** `https://catalog.tmd.go.th/`
13. **Thaiwater:** `https://www.thaiwater.net/`
14. **data.go.th:** `https://data.go.th/`
15. **TomTom Traffic:** `https://developer.tomtom.com/traffic-api`
16. **TomTom Traffic Index:** `https://www.tomtom.com/traffic-index/city/bangkok`
17. **Inside Airbnb:** `http://insideairbnb.com/get-the-data/`
18. **OSM Overpass:** `https://overpass-api.de/api/interpreter`
19. **Overture Maps:** `https://overturemaps.org/`
20. **Google EIE:** `https://insights.sustainability.google/`
21. **Copernicus CAMS:** `https://atmosphere.copernicus.eu/`
22. **NASA GPM:** `https://gpm.nasa.gov/`
23. **WorldPop:** `https://www.worldpop.org/`
24. **GHSL:** `https://ghsl.jrc.ec.europa.eu/`
25. **Thai RSC:** `https://www.thairsc.com/`
26. **Bank of Thailand:** `https://www.bot.or.th/`
27. **Apify Transit:** `https://apify.com/jungle_synthesizer/thailand-transit-scraper`
28. **Singapore Smart Nation:** `https://www.smartnation.gov.sg/`
29. **Barcelona Sentilo:** `https://sentilo.io/`
30. **NYC Open Data:** `https://opendata.cityofnewyork.us/`
31. **London Datastore:** `https://data.london.gov.uk/`
