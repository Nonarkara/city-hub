#!/usr/bin/env python3
"""Extract transparent City Hub brand assets from the approved exploration sheet."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


CROPS = {
    "city-hub-lockup.png": (31, 82, 318, 329),
    "city-hub-mark.png": (93, 82, 288, 230),
    "city-hub-wordmark.png": (33, 229, 315, 326),
    "city-hub-app.png": (353, 78, 468, 185),
    "city-hub-mono.png": (353, 211, 468, 318),
}


def remove_white_matte(image: Image.Image) -> Image.Image:
    """Turn the flattened white matte into alpha while preserving pale artwork."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    exterior: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def is_matte(pixel: tuple[int, int, int]) -> bool:
        return min(pixel) >= 235 and max(pixel) - min(pixel) <= 14

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in exterior or not is_matte(rgb.getpixel((x, y))):
            continue
        exterior.add((x, y))
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    rgba = rgb.convert("RGBA")
    pixels = []
    for index, (red, green, blue) in enumerate(rgb.getdata()):
        point = (index % width, index // width)
        # The source is a flattened sheet: remove its connected white page and
        # preserve the designer's white knockouts as true transparency.
        knockout = min(red, green, blue) >= 248 and max(red, green, blue) - min(red, green, blue) <= 8
        if point in exterior or knockout:
            pixels.append((0, 0, 0, 0))
            continue
        pixels.append((red, green, blue, 255))

    rgba.putdata(pixels)
    bounds = rgba.getbbox()
    if bounds:
        rgba = rgba.crop(bounds)
    return rgba


def square_canvas(image: Image.Image, size: int, padding_ratio: float = 0.08) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    available = round(size * (1 - padding_ratio * 2))
    scale = min(available / image.width, available / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    args.output.mkdir(parents=True, exist_ok=True)

    extracted: dict[str, Image.Image] = {}
    for filename, crop in CROPS.items():
        asset = remove_white_matte(source.crop(crop))
        asset.save(args.output / filename, optimize=True)
        extracted[filename] = asset

    app_icon = extracted["city-hub-app.png"]
    for size in (32, 180, 192, 512):
        icon = square_canvas(app_icon, size)
        name = "apple-touch-icon.png" if size == 180 else f"icon-{size}.png"
        icon.save(args.output.parent / name, optimize=True)

    # Android maskable icons require an opaque, full-bleed background.
    for size in (192, 512):
        maskable = Image.new("RGBA", (size, size), (4, 6, 11, 255))
        mark = square_canvas(extracted["city-hub-mark.png"], size, padding_ratio=0.18)
        maskable.alpha_composite(mark)
        maskable.save(args.output.parent / f"icon-maskable-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
