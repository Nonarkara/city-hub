# TimeFM — shared pattern

Google's TimesFM 2.5 (200M-param decoder-only transformer) for univariate time-series forecasting. **Bake offline → commit forecast JSON → dashboard reads it.** Same pattern as AlphaEarth: no model runtime in the browser, no PyTorch in the Cloudflare Worker.

## Canonical implementation

Working source of truth lives in **`chonburi-control-tower`**:

| File | What it is |
|------|------------|
| `chonburi-control-tower/scripts/timefm/forecast_series.py` | Loads TimesFM 2.5, takes a CSV or inline series, writes forecast JSON + updates manifest |
| `chonburi-control-tower/scripts/timefm/samples/chonburi-tide-30d.csv` | 720-point reference series (Gulf of Thailand harmonic tide) used to validate the pipeline |
| `chonburi-control-tower/scripts/timefm/README.md` | Smoke-test recipe + agreement notes |
| `chonburi-control-tower/apps/web/src/components/TimeFM/Forecast.tsx` | `useTimeFMForecast(label, aoi)` hook + `<TimeFMBadge>` component |

## Validation result (from the Chonburi pilot)

Fed TimeFM 30 days of synthetic Gulf-of-Thailand harmonic tide (7-constituent model, hourly). Forecast 48h ahead. Compared to a held-out continuation of the same harmonic:

- **Mean abs error: 1.5 cm**
- **Max abs error: 3.4 cm**
- **Correlation: 0.991**

TimeFM recovered the regional tidal constituents from history alone — no physics knowledge baked in. This validates the pattern for any sufficiently-periodic dashboard series.

## Drop-in to another dashboard (5 minutes)

1. Copy `scripts/timefm/` into your repo.

2. Copy `apps/web/src/components/TimeFM/` into your dashboard's components dir.

3. One-time install:
   ```bash
   pip install --user timesfm numpy
   ```
   First load downloads ~1.5 GB of model weights to `~/.cache/huggingface/`. Forecasting itself is ~100 ms on an M-series Mac.

4. Bake a forecast for any series your dashboard exposes:
   ```bash
   python3 scripts/timefm/forecast_series.py \
       --input path/to/series.csv \
       --horizon 24 \
       --label aqi --aoi your-aoi \
       --out apps/web/public/data/timefm/forecast-aqi-your-aoi.json
   ```

   CSV format: header row + `timestamp,value` per row. Or pass `--values 1.2,1.4,1.6,...` inline.

5. Wire into a component:
   ```tsx
   import { useTimeFMForecast, TimeFMBadge } from "./components/TimeFM/Forecast";

   const { forecast } = useTimeFMForecast("aqi", "your-aoi");

   <TimeFMBadge
     forecast={forecast}
     baseline={existingAnalyticForecast?.next24h}
     unit="µg/m³"
   />
   ```

   Pass `baseline=null` if you have no analytic forecast to compare against — the badge then shows the TimeFM range alone. Pass a `baseline` array of the same length as the forecast horizon and the badge shows the Δ vs that baseline + an "agrees / diverges" verdict.

6. Commit the forecast JSON + manifest. Done.

## Series suitable for TimeFM

The model is calibrated for low-frequency univariate series — anything sampled at minutes-to-hours-to-days cadence with some seasonal / periodic structure. Examples across the Non dashboards:

| Dashboard | Series candidates |
|-----------|-------------------|
| **Chonburi / NST / BMA** | Tide height, AQI / PM2.5 trend, weather (temp, precip), traffic count, citizen-report volume |
| **SCITI / SCITI Monitor** | City-level scores month-over-month, news mention rate per city, search-trend volume |
| **Chula CT-01** | Building-cluster occupancy proxy, AC load forecast, campus shuttle ridership |
| **2026 Oil Crisis** | WTI / Brent close, OPEC quota trajectory, refinery throughput |
| **Phuket smart bus** | Route-level ridership, departure delay, arrival-time accuracy |
| **conflict tracker** | Event-count per region per day, fatality trend, news-volume per actor |

## Constraints (read before extending)

- Univariate only. For multivariate forecasting (e.g. "AQI given weather + traffic"), use a different model — TimesFM is calibrated single-series.
- Quantile head: the JSON includes q10/q90 bands. Use them in the UI — show uncertainty, don't pretend forecasts are deterministic.
- Forecast horizon ≤ a few hundred steps in the same calibration window. For longer-term forecasting (year+), the model degrades — use it for tactical (hours-to-weeks), not strategic.
- Re-bake when fresh data arrives. The pattern is offline-bake-then-commit, so dashboards never see a stale forecast unless someone forgets to re-bake. Add a cron or a CI hook for production dashboards with frequent updates.

## Compared to the existing analytic forecasts

- **Tides** — the dashboard's harmonic model is already 1–3 cm accurate for normal tides. TimeFM adds value during anomalies (storm surge, gauge drift) where divergence FROM the harmonic IS the signal.
- **AQI** — the existing `aqi/trend` endpoint uses a short-horizon prediction. TimeFM extends the horizon and adds uncertainty bands.
- **Markets / WTI** — TimeFM produces plausible point-forecasts; the q10/q90 band is what you actually trust. Never present markets forecasts without the uncertainty band visible.
