# Define the application's mark once: geometry, the SVG, and the Android vector.
"""The mark is a pawn cut as ink on a printed plate.

Plain flat inks, no gradient and no shadow, and one deliberately off-centre
element — the rule under the piece sits right of centre and runs past its base,
the way a line set by hand lands rather than one centred by a grid. The plate is
a squircle: a superellipse with n = 5, which rounds the corners about as much as
a phone's icon mask but continuously instead of as a circle stuck onto a square.

Every platform icon is rendered from this one file, so changing the numbers here
and running `npm run assets` is the whole edit. Coordinates are in a 100-unit
square unless a function says otherwise.
"""

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "public" / "favicon.svg"

BOX = 100.0
SQUIRCLE = 5.0
TILE = "#295e49"
INK = "#e5e4cf"
RULE_INK = "#a6bcae"

# Android draws an adaptive icon on a 108-unit canvas. The launcher masks it to
# its own shape, and the part that survives every mask is a 66-unit circle, so
# the piece is scaled to touch that circle and nothing else. The plate behind it
# is drawn to the whole canvas, because whatever the mask, it must be covered.
ANDROID_VIEWPORT = 108.0
ANDROID_VISIBLE_CIRCLE = 66.0
ANDROID_LAYER_HEIGHT = 72.0

HEAD_CENTER = (50.0, 26.0)
HEAD_RADIUS = 14.0
# Each piece of the pawn overlaps the next, so no hairline seam shows between
# the fills at small sizes.
COLLAR = [(41.0, 30.0), (59.0, 30.0), (61.0, 42.0), (39.0, 42.0)]
FLANK_LEFT = [(39.0, 41.0), (38.5, 52.0), (34.0, 61.0), (33.5, 67.0)]
FLANK_RIGHT = [(61.0, 41.0), (61.5, 52.0), (66.0, 61.0), (66.5, 67.0)]
BASE = [(33.5, 66.0), (66.5, 66.0), (70.5, 75.5), (29.5, 75.5)]
PLINTH = [(29.5, 74.5), (70.5, 74.5), (72.0, 80.5), (28.0, 80.5)]
RULE = (52.0, 84.5, 88.0, 89.0)


def _unit(number: float) -> str:
    """Format a coordinate without trailing noise."""
    text = f"{number:.2f}".rstrip("0").rstrip(".")
    return "0" if text in {"-0", ""} else text


class _Pen:
    """Emit path data in any canvas, from coordinates in mark units."""

    def __init__(self, scale: float = 1.0, offset=(0.0, 0.0)):
        self.scale = scale
        self.offset = offset

    def point(self, pair) -> str:
        x = pair[0] * self.scale + self.offset[0]
        y = pair[1] * self.scale + self.offset[1]
        return f"{_unit(x)} {_unit(y)}"

    def length(self, value: float) -> str:
        return _unit(value * self.scale)

    def polygon(self, points) -> str:
        head = f"M{self.point(points[0])}"
        return head + "".join(f"L{self.point(p)}" for p in points[1:]) + "Z"


def piece_bounds() -> tuple:
    """The pawn's bounding box in mark units, corners included."""
    points = [HEAD_CENTER, COLLAR[0], COLLAR[2], *FLANK_LEFT, *FLANK_RIGHT, *BASE, *PLINTH]
    xs = [p[0] - HEAD_RADIUS for p in [HEAD_CENTER]] + [p[0] for p in points]
    ys = [p[1] - HEAD_RADIUS for p in [HEAD_CENTER]] + [p[1] for p in points]
    xs += [HEAD_CENTER[0] + HEAD_RADIUS]
    ys += [HEAD_CENTER[1] + HEAD_RADIUS]
    return min(xs), min(ys), max(xs), max(ys)


def silhouette_points():
    """Points along the pawn's outline, enough to measure its extremes."""
    points = [HEAD_CENTER, *COLLAR, *BASE, *PLINTH, *FLANK_LEFT, FLANK_RIGHT[3]]
    head_x, head_y = HEAD_CENTER
    for step in range(48):
        angle = step / 48 * 2 * math.pi
        points.append(
            (
                head_x + HEAD_RADIUS * math.cos(angle),
                head_y + HEAD_RADIUS * math.sin(angle),
            )
        )
    points.extend(bezier_points(FLANK_LEFT, 24))
    points.extend(bezier_points((FLANK_RIGHT[0], FLANK_RIGHT[1], FLANK_RIGHT[2], FLANK_RIGHT[3]), 24))
    return points


def safe_zone_fit() -> tuple:
    """Scale and offset that centre the pawn on Android's adaptive icon.

    The foreground is drawn on a 108-unit canvas and only a 66-unit circle
    survives every launcher mask, so the piece is scaled until its furthest
    point touches that circle, then centred on the canvas.
    """
    left, top, right, bottom = piece_bounds()
    centre_x = (left + right) / 2
    centre_y = (top + bottom) / 2
    furthest = max(
        math.hypot(point[0] - centre_x, point[1] - centre_y)
        for point in silhouette_points()
    )
    # Rounded down, never up: the scale is written into the drawn path, and a
    # scale that rounds up would push a corner of the base past the mask.
    scale = math.floor(ANDROID_VISIBLE_CIRCLE / 2 / furthest * 10_000) / 10_000
    return (
        scale,
        round(ANDROID_VIEWPORT / 2 - scale * centre_x, 2),
        round(ANDROID_VIEWPORT / 2 - scale * centre_y, 2),
    )


def android_layer_fit() -> _Pen:
    """The pen that draws the plate across the whole adaptive canvas."""
    return _Pen(ANDROID_VIEWPORT / BOX, (0.0, 0.0))


def piece_path(pen: _Pen) -> str:
    """The pawn: head, collar, flared body, base, plinth."""
    head = (
        f"M{pen.point((HEAD_CENTER[0] - HEAD_RADIUS, HEAD_CENTER[1]))}"
        f"a{pen.length(HEAD_RADIUS)} {pen.length(HEAD_RADIUS)} 0 1 0 "
        f"{pen.length(HEAD_RADIUS * 2)} 0"
        f"a{pen.length(HEAD_RADIUS)} {pen.length(HEAD_RADIUS)} 0 1 0 "
        f"-{pen.length(HEAD_RADIUS * 2)} 0Z"
    )
    body = (
        f"M{pen.point(FLANK_LEFT[0])}"
        f"C{pen.point(FLANK_LEFT[1])} {pen.point(FLANK_LEFT[2])} {pen.point(FLANK_LEFT[3])}"
        f"L{pen.point(FLANK_RIGHT[3])}"
        f"C{pen.point(FLANK_RIGHT[2])} {pen.point(FLANK_RIGHT[1])} {pen.point(FLANK_RIGHT[0])}Z"
    )
    return (
        head
        + pen.polygon(COLLAR)
        + body
        + pen.polygon(BASE)
        + pen.polygon(PLINTH)
    )


def android_foreground_path() -> str:
    """The pawn alone, sized and placed for an adaptive icon's foreground."""
    scale, offset_x, offset_y = safe_zone_fit()
    return piece_path(_Pen(scale, (offset_x, offset_y)))


def android_background_path() -> str:
    """The plate, drawn across the whole canvas so no mask shows a gap."""
    return tile_path(android_layer_fit())


def bezier_points(control, steps: int = 24):
    """Sample one cubic curve, for raster prototypes."""
    p0, p1, p2, p3 = control
    samples = []
    for step in range(steps + 1):
        t = step / steps
        u = 1 - t
        samples.append(
            (
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            )
        )
    return samples


def corner_curvature() -> float:
    """The Bézier handle whose curve stays closest to the squircle.

    The curve runs from the middle of one side to the middle of the next; the
    handle is chosen by solving for the curve that keeps the distance from the
    tile's centre — measured with the p = SQUIRCLE norm — closest to the half
    width.
    """
    half = BOX / 2

    def worst_deviation(handle: float) -> float:
        worst = 0.0
        for step in range(1, 120):
            t = step / 120
            u = 1 - t
            x = (
                u**3 * half
                + 3 * u * u * t * (half + handle)
                + 3 * u * t * t * BOX
                + t**3 * BOX
            )
            y = 3 * u * t * t * (half - handle) + t**3 * half
            across, down = abs(x - half), abs(y - half)
            radius = (across**SQUIRCLE + down**SQUIRCLE) ** (1 / SQUIRCLE)
            worst = max(worst, abs(radius - half))
        return worst

    best, best_deviation = 0.0, float("inf")
    for step in range(0, 1001):
        handle = step / 1000 * half
        deviation = worst_deviation(handle)
        if deviation < best_deviation:
            best, best_deviation = handle, deviation
    return best


def tile_path(pen: _Pen = None) -> str:
    """The squircle plate as four curves along its flat sides."""
    pen = pen or _Pen()
    half = BOX / 2
    handle = corner_curvature()
    top, right, bottom, left = (half, 0.0), (BOX, half), (half, BOX), (0.0, half)
    corners = [
        (top, (half + handle, 0.0), (BOX, half - handle), right),
        (right, (BOX, half + handle), (half + handle, BOX), bottom),
        (bottom, (half - handle, BOX), (0.0, half + handle), left),
        (left, (0.0, half - handle), (half - handle, 0.0), top),
    ]
    parts = [f"M{pen.point(top)}"]
    for _, control_a, control_b, end in corners:
        parts.append(f"C{pen.point(control_a)} {pen.point(control_b)} {pen.point(end)}")
    return "".join(parts) + "Z"


def rule_path(pen: _Pen = None) -> str:
    """The off-centre printer's rule."""
    pen = pen or _Pen()
    x0, y0, x1, y1 = RULE
    return pen.polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def svg() -> str:
    """The mark as a standalone SVG file."""
    return (
        "<!-- The application's mark: a pawn in ink on a printed plate, with the\n"
        "     printer's rule set off centre. Generated by scripts/app_mark.py —\n"
        "     change the geometry there and rewrite this file, or the checks fail. -->\n"
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_unit(BOX)} {_unit(BOX)}"'
        ' role="img" aria-label="gwaymaegyi chess">\n'
        f'  <path fill="{TILE}" d="{tile_path()}"/>\n'
        f'  <path fill="{INK}" d="{piece_path(_Pen())}"/>\n'
        f'  <path fill="{RULE_INK}" d="{rule_path()}"/>\n'
        "</svg>\n"
    )


def main() -> None:
    arguments = [a for a in sys.argv[1:] if a != "--write"]
    target = Path(arguments[0]) if arguments else SVG_PATH
    if "--write" in sys.argv:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(svg())
        print(f"Wrote {target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}")
    else:
        sys.stdout.write(svg())


if __name__ == "__main__":
    main()
