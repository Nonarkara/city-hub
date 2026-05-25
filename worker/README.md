# UNL City Hub — Cloudflare Worker

Single Worker that handles three classes of upstream traffic for the dashboard:

1. **CORS proxy** — `GET /:target/*path` for upstream APIs that block browser
   requests (data.go.th, data.bangkok.go.th, TMD, WAQI, FIRMS, Traffy, GDELT)
2. **Forecast** — `POST /forecast` returns 24h-ahead numeric forecasts
3. **Narrate** — `POST /narrate` returns AI-narrated explanations
4. **Earth Engine** — `POST /ee/mapid` returns tile URL for an EE expression

## Secrets

Set via `npx wrangler secret put <NAME>` (interactive prompt).

| Secret | Used for | Required for |
|---|---|---|
| `GEMINI_API_KEY` | `/forecast` and `/narrate` Gemini paths | Gemini-narrated alerts + Gemini forecasts |
| `HF_API_TOKEN` | `/forecast` TimeFM path (HF serverless) | TimeFM via HuggingFace |
| `TIMEFM_ENDPOINT_URL` | Override default HF URL | Your own TimeFM deployment |
| `GCP_SERVICE_ACCOUNT_JSON` | `/ee/mapid` Earth Engine auth | AlphaEarth and any EE-backed layer |

## Forecast backend priority

`POST /forecast` tries backends in order:

1. **Gemini 2.5 Flash** if `GEMINI_API_KEY` set — free tier, structured JSON
2. **TimeFM 2.0** if `HF_API_TOKEN` set — see TimeFM section below
3. **Holt-Winters** — always available, computed in-Worker

The response's `model` field tells the truth about which one answered.

## Activating TimeFM 2.0

TimeFM is Google's open-source time-series foundation model. It's NOT on
HuggingFace's serverless allow-list (verified 2026-05), so just setting
`HF_API_TOKEN` will return 404. To actually run TimeFM you need to host it.

### Path A: HuggingFace Space (free, CPU, ~10s cold start)

1. Sign up at huggingface.co, accept terms at
   https://huggingface.co/google/timesfm-2.0-500m-pytorch
2. Fork the TimeFM demo Space (huggingface.co/spaces/google/timesfm-2.0)
3. Deploy as Gradio Space (free CPU tier)
4. Set both secrets:
   ```
   npx wrangler secret put HF_API_TOKEN              # your HF token
   npx wrangler secret put TIMEFM_ENDPOINT_URL       # your-space-url/api/predict
   ```
5. Refresh dashboard — model chip switches to `TIMEFM 2.0`

### Path B: Modal (free $30/mo credits, fast)

```python
# modal_app.py
import modal
app = modal.App("timesfm")
image = modal.Image.debian_slim().pip_install("timesfm", "torch")

@app.function(image=image, gpu="A10G")
@modal.web_endpoint(method="POST")
def forecast(item: dict):
    import timesfm
    model = timesfm.TimesFm(...)
    return {"forecast": model.forecast(item["inputs"]["history"], horizon=item["inputs"]["horizon"])}
```

```bash
modal deploy modal_app.py
# Set the returned URL as TIMEFM_ENDPOINT_URL
```

### Path C: Vertex AI (paid)

Deploy the model to Vertex AI from the Model Garden. Use the prediction
endpoint URL.

## Activating AlphaEarth (Google Earth Engine)

`POST /ee/mapid` mints OAuth2 tokens from a GCP service account and calls
Earth Engine's `getMapId` REST endpoint, returning a tile URL template
that MapLibre consumes directly.

### Setup (one-time, ~10 min)

1. **Create GCP project** at https://console.cloud.google.com
2. **Enable Earth Engine API** for the project
   ```
   gcloud services enable earthengine.googleapis.com --project=YOUR_PROJECT
   ```
3. **Register the project with Earth Engine** at https://code.earthengine.google.com/register
4. **Create service account**:
   ```
   gcloud iam service-accounts create unl-ee-reader \
     --description="UNL City Hub Earth Engine reader" \
     --display-name="UNL EE Reader" \
     --project=YOUR_PROJECT
   ```
5. **Grant Earth Engine role**:
   ```
   gcloud projects add-iam-policy-binding YOUR_PROJECT \
     --member="serviceAccount:unl-ee-reader@YOUR_PROJECT.iam.gserviceaccount.com" \
     --role="roles/earthengine.viewer"
   ```
6. **Download JSON key**:
   ```
   gcloud iam service-accounts keys create ee-key.json \
     --iam-account=unl-ee-reader@YOUR_PROJECT.iam.gserviceaccount.com
   ```
7. **Set as Worker secret** (paste entire JSON file contents at the prompt):
   ```
   cd worker && npx wrangler secret put GCP_SERVICE_ACCOUNT_JSON
   ```
8. **Delete local copy** — the secret lives only in Cloudflare:
   ```
   rm ee-key.json
   ```

Refresh dashboard, toggle `ALPHAEARTH` in the layer rail. Tiles should
appear within a couple of seconds.

### Available EE presets

Defined in `EE_PRESETS` in `src/index.ts`. Currently `alphaearth` only —
visualizes `GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL` first 3 PCA bands as RGB.

To add more (e.g. Sentinel-2 burst, Dynamic World, NICFI Planet):
1. Add an entry to `EE_PRESETS` with an EE serialized expression
2. Add the new preset to the `EEPreset` type in `src/data/alphaearth.ts`
3. Wire as a new layer in `bangkok-layers.ts` + `use-bangkok-layers.ts`

## Local dev

```
cd worker
npm install
npx wrangler dev    # http://localhost:8787
```

Test routes:
```
curl -X POST http://localhost:8787/forecast \
  -H "Content-Type: application/json" \
  -d '{"series":[40,42,45,48],"horizon":6}'

curl -X POST http://localhost:8787/ee/mapid \
  -H "Content-Type: application/json" \
  -d '{"preset":"alphaearth"}'
```

## Deploy

```
cd worker && npx wrangler deploy
```
