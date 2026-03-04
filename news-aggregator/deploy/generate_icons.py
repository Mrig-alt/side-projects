#!/usr/bin/env python3
"""
Generate PNG icons for the PWA from a simple programmatic design.
Run once after cloning:

    pip install Pillow
    python deploy/generate_icons.py

This creates:
    frontend/icon-192.png   (Android/Chrome PWA icon)
    frontend/icon-512.png   (Android/Chrome PWA splash)
    frontend/apple-touch-icon.png  (iOS home screen — 180x180)
"""

import os
from PIL import Image, ImageDraw

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")
BG = (13, 15, 20)       # #0d0f14
BLUE = (79, 142, 247)   # #4f8ef7


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded background
    r = size // 6
    draw.rounded_rectangle([0, 0, size, size], radius=r, fill=BG)

    # Lightning bolt polygon — same proportions as icon.svg viewBox 0 0 512 512
    scale = size / 512
    bolt = [
        (310 * scale, 60 * scale),
        (195 * scale, 270 * scale),
        (262 * scale, 270 * scale),
        (195 * scale, 450 * scale),
        (325 * scale, 240 * scale),
        (255 * scale, 240 * scale),
    ]
    draw.polygon(bolt, fill=BLUE)
    return img


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    path = os.path.join(FRONTEND, name)
    img = draw_icon(size)
    img.save(path, "PNG")
    print(f"Generated {path}")

print("\nDone! Add apple-touch-icon.png to your server and link it in index.html.")
