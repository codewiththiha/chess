# Render the desktop icon set from the same four-square mark as public/favicon.svg.
"""Regenerate src-tauri/icons from the application's own mark.

Run with Pillow installed (``python3 -m pip install pillow``):

    python3 scripts/make-icons.py

The four colours and the 16/64 corner radius are copied from the favicon so the
desktop shell, the browser tab, and the in-app rail mark stay the same artwork.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src-tauri" / "icons"

GREEN = "#295e49"
CREAM = "#e5e4cf"
SAGE = "#a6bcae"

# Fractions of the 64-unit favicon grid: rounded square, then four quadrants.
RADIUS = 16 / 64
SQUARES = [
    (14, 14, CREAM),
    (32, 32, CREAM),
    (32, 14, SAGE),
    (14, 32, SAGE),
]
SIZE = 18 / 64
SUPERSAMPLE = 4

TARGETS = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}


def render(pixels: int) -> Image.Image:
    """Draw one square icon at `pixels` with supersampling for clean edges."""
    scale = pixels * SUPERSAMPLE
    image = Image.new("RGBA", (scale, scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, scale - 1, scale - 1), radius=RADIUS * scale, fill=GREEN
    )
    for x, y, colour in SQUARES:
        draw.rectangle(
            (x / 64 * scale, y / 64 * scale, (x + SIZE * 64) / 64 * scale, (y + SIZE * 64) / 64 * scale),
            fill=colour,
        )
    return image.resize((pixels, pixels), Image.LANCZOS).convert("RGBA")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, pixels in TARGETS.items():
        render(pixels).save(OUTPUT / name)
        print(f"wrote {OUTPUT.relative_to(ROOT) / name} ({pixels}px)")


if __name__ == "__main__":
    main()
