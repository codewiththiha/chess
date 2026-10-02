# Render the desktop icon set from the same four-square mark as public/favicon.svg.
"""Regenerate src-tauri/icons from the application's own mark.

Run with Pillow installed (``python3 -m pip install pillow``):

    python3 scripts/make-icons.py

The four colours and the 16/64 corner radius are copied from the favicon so the
desktop shell, the browser tab, and the in-app rail mark stay the same artwork.
Windows additionally compiles a resource file from ``icon.ico``, which this
script writes in every size the shell may ask for.
"""

import io
import struct
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

# The sizes Windows picks between in the task bar, the alt-tab list, and the
# file explorer. 256 is stored as a PNG, the rest as classic bitmaps, which is
# what the resource compiler reads.
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)


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


def bitmap(image: Image.Image, pixels: int) -> bytes:
    """One icon frame: a 32-bit bottom-up bitmap and an opaque AND mask."""
    header = struct.pack(
        "<IiiHHIIiiII", 40, pixels, pixels * 2, 1, 32, 0, pixels * pixels * 4, 0, 0, 0, 0
    )
    data = image.load()
    rows = b"".join(
        b"".join(
            bytes((data[x, y][2], data[x, y][1], data[x, y][0], data[x, y][3]))
            for x in range(pixels)
        )
        for y in range(pixels - 1, -1, -1)
    )
    mask = bytes(((pixels + 31) // 32) * 4 * pixels)
    return header + rows + mask


def write_ico(path: Path) -> None:
    """Write every size into one .ico, the way a Windows build reads it."""
    frames = []
    for pixels in ICO_SIZES:
        if pixels >= 256:
            buffer = io.BytesIO()
            render(pixels).save(buffer, format="PNG", optimize=True)
            frames.append(buffer.getvalue())
        else:
            frames.append(bitmap(render(pixels), pixels))
    offset = 6 + 16 * len(frames)
    directory = struct.pack("<HHH", 0, 1, len(frames))
    entries = b""
    for pixels, frame in zip(ICO_SIZES, frames):
        entries += struct.pack(
            "<BBBBHHII", pixels % 256, pixels % 256, 0, 0, 1, 32, len(frame), offset
        )
        offset += len(frame)
    path.write_bytes(directory + entries + b"".join(frames))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, pixels in TARGETS.items():
        render(pixels).save(OUTPUT / name)
        print(f"wrote {OUTPUT.relative_to(ROOT) / name} ({pixels}px)")
    write_ico(OUTPUT / "icon.ico")
    print(f"wrote {OUTPUT.relative_to(ROOT) / 'icon.ico'} ({', '.join(str(s) for s in ICO_SIZES)}px)")


if __name__ == "__main__":
    main()
