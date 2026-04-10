#!/usr/bin/env python3
"""
NUZU News — Icon Generator
Run this script once to generate all required Play Store / PWA icon sizes.
Requires: pip install Pillow

Usage:
    python3 generate_icons.py

Output: icons/ directory with all required PNG sizes.
"""

import os
from PIL import Image, ImageDraw, ImageFont

SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "icons")

# ── NUZU Brand Colors ──
NAVY      = (7,  15, 43,  255)   # --nuzu-navy   #070F2B
DARK      = (13, 27, 75,  255)   # --nuzu-dark   #0D1B4B
BLUE      = (30, 79, 216, 255)   # --nuzu-blue   #1E4FD8
WHITE     = (255, 255, 255, 255)

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]

def get_font(size):
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = max(4, int(size * 0.175))

    # Background: navy rounded rect
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=DARK)

    # Blue accent stripe at top (6% of height)
    stripe_h = max(3, int(size * 0.06))
    draw.rounded_rectangle([0, 0, size - 1, stripe_h * 2], radius=radius, fill=BLUE)
    draw.rectangle([0, stripe_h, size - 1, stripe_h * 2], fill=DARK)

    # "NZ" text centered
    font_size = int(size * 0.40)
    font = get_font(font_size)
    text = "NZ"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] + (stripe_h * 0.3)  # slight nudge down for stripe
    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating icons in: {OUTPUT_DIR}")
    for size in SIZES:
        img = make_icon(size)
        path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
        img.save(path, "PNG", optimize=True)
        print(f"  ✓  icon-{size}.png  ({size}×{size}px)")
    print(f"\nDone. {len(SIZES)} icons generated.")
    print("Place the 'icons/' folder in your GitHub repo root (same level as index.html).")

if __name__ == "__main__":
    main()
