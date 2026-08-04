#!/usr/bin/env python3
"""
bake-city-buildings.py — portable OSM → UNL 3D footprints

Conservation law (city-to-city):
  city.threeD ∧ city.buildings3dUrl ⇒ MapView extrudes FeatureCollection
  features with properties { h, real?, base? }. Heights come from OSM
  (`height` tag → building:levels×3 → 9 m fallback). No invented metrics.

Usage:
  python3 scripts/bake-city-buildings.py \\
    --city ljubljana \\
    --bbox 14.48,46.03,14.54,46.08 \\
    --output public/geo/ljubljana-buildings.geojson

Adapted from bkk-3d-atlas/scripts/osm-buildings-to-geojson.py (ODbL).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any

# Primary + fallbacks — overpass-api.de often 504s under load.
OVERPASS_URLS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "UNL-city-hub/0.9 (https://city-hub.pages.dev; OSM building bake)"


def parse_levels(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value) * 3.0
    except ValueError:
        return None


def parse_height(value: str | None) -> float | None:
    if not value:
        return None
    raw = value.strip().lower().replace("m", "").strip()
    try:
        return float(raw)
    except ValueError:
        return None


def estimate_height(tags: dict[str, str]) -> tuple[float, float, int]:
    """Return (height_m, base_m, real_flag). real=1 when OSM had an explicit height/levels."""
    h = parse_height(tags.get("height"))
    real = 1
    if h is None:
        levels = parse_levels(tags.get("building:levels") or tags.get("levels"))
        if levels is not None:
            h = levels
        else:
            h = 9.0
            real = 0
    base = parse_height(tags.get("min_height")) or 0.0
    return h, base, real


def fetch_overpass(west: float, south: float, east: float, north: float, *, retries: int = 2) -> dict[str, Any]:
    # Overpass bbox order: south,west,north,east
    query = (
        "[out:json][timeout:180];\n"
        f'(way["building"]({south},{west},{north},{east});'
        f'relation["building"]({south},{west},{north},{east}););\n'
        "out body geom;"
    )
    last_error: Exception | None = None
    import requests

    for url in OVERPASS_URLS:
        for attempt in range(1, retries + 1):
            try:
                print(f"Trying {url} (attempt {attempt})…", file=sys.stderr)
                response = requests.post(
                    url,
                    data={"data": query},
                    headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                    timeout=240,
                )
                response.raise_for_status()
                return response.json()
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                print(f"  failed: {exc}", file=sys.stderr)
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Overpass failed on all mirrors: {last_error}")


def way_to_feature(element: dict[str, Any], city: str) -> dict[str, Any] | None:
    if element.get("type") != "way":
        return None
    geometry = element.get("geometry") or []
    if len(geometry) < 3:
        return None
    coords = [[pt["lon"], pt["lat"]] for pt in geometry]
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    if len(coords) < 4:
        return None
    tags = element.get("tags") or {}
    h, base, real = estimate_height(tags)
    props: dict[str, Any] = {
        "h": h,
        "real": real,
        "base": base,
        "id": f"{city}-bldg-{element.get('id', 0)}",
    }
    if tags.get("name"):
        props["name"] = tags["name"]
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Polygon", "coordinates": [coords]},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--city", required=True, help="City id slug (e.g. ljubljana)")
    parser.add_argument("--bbox", required=True, help="minLon,minLat,maxLon,maxLat")
    parser.add_argument("--output", required=True, help="Output .geojson path")
    parser.add_argument("--limit", type=int, default=0, help="Cap features (0 = no limit)")
    args = parser.parse_args()

    west, south, east, north = (float(p) for p in args.bbox.split(","))
    payload = fetch_overpass(west, south, east, north)

    features: list[dict[str, Any]] = []
    for element in payload.get("elements", []):
        feat = way_to_feature(element, args.city)
        if not feat:
            continue
        features.append(feat)
        if args.limit and len(features) >= args.limit:
            break

    geojson = {
        "type": "FeatureCollection",
        "name": f"{args.city}-3d-buildings",
        "license": "ODbL-1.0 (© OpenStreetMap contributors)",
        "source": "OpenStreetMap via Overpass",
        "bbox": [west, south, east, north],
        "extrusion_strategy": "h from height tag, else building:levels×3, else 9m; real=1 when OSM-sourced",
        "features": features,
    }

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(geojson, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {len(features)} building features → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
