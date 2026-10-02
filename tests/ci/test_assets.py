# Hold the app mark to its own rules: flat inks, one off-centre note, and a
# piece that fits inside Android's guaranteed mask.
from pathlib import Path
import math
import sys
import unittest
import xml.etree.ElementTree as ElementTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import app_mark


class MarkTests(unittest.TestCase):
    def test_the_committed_svg_is_what_the_mark_draws(self):
        self.assertEqual((ROOT / "public/favicon.svg").read_text(), app_mark.svg())

    def test_the_mark_is_flat_ink(self):
        # No gradient, no shadow, no blur, nothing drawn with a stroke: the
        # whole mark is three filled paths, which is what keeps it legible at
        # 16 px and printable in one colour.
        drawing = app_mark.svg()
        for banned in ("Gradient", "filter", "opacity", "stroke", "style="):
            with self.subTest(banned=banned):
                self.assertNotIn(banned, drawing)
        root = ElementTree.fromstring(drawing)
        paths = [child for child in root if child.tag.endswith("path")]
        self.assertEqual([p.attrib["fill"] for p in paths], [app_mark.TILE, app_mark.INK, app_mark.RULE_INK])
        self.assertTrue(root.attrib["aria-label"])

    def test_the_rule_is_the_one_off_centre_note(self):
        # The composition is symmetric except for the printer's rule, which sits
        # right of centre and runs past the piece. This is the deliberate part.
        left, _, right, _ = app_mark.RULE
        self.assertGreater((left + right) / 2, app_mark.BOX / 2)
        piece_left, _, piece_right, piece_bottom = app_mark.piece_bounds()
        self.assertGreater(right, piece_right)
        self.assertLess(left, piece_right)
        self.assertGreater(app_mark.RULE[1], piece_bottom)

    def test_the_piece_fits_android_s_guaranteed_circle(self):
        scale, offset_x, offset_y = app_mark.safe_zone_fit()
        centre_x, centre_y = app_mark.ANDROID_VIEWPORT / 2, app_mark.ANDROID_VIEWPORT / 2
        furthest = max(
            math.hypot(
                point[0] * scale + offset_x - centre_x,
                point[1] * scale + offset_y - centre_y,
            )
            for point in app_mark.silhouette_points()
        )
        radius = app_mark.ANDROID_VISIBLE_CIRCLE / 2
        self.assertLessEqual(furthest, radius)
        # It should touch that circle: an adaptive icon that floats well inside
        # it looks small next to every other icon on the home screen.
        self.assertGreater(furthest, radius - 0.1)

    def test_the_plate_covers_the_whole_adaptive_canvas(self):
        pen = app_mark.android_layer_fit()
        self.assertAlmostEqual(pen.scale * app_mark.BOX, app_mark.ANDROID_VIEWPORT, places=6)
        self.assertEqual(pen.offset, (0.0, 0.0))

    def test_the_tile_is_a_squircle_not_a_rounded_rectangle(self):
        # Every point on the corner curve should sit the half width away from
        # the tile's centre, measured with the superellipse's own norm.
        handle = app_mark.corner_curvature()
        half = app_mark.BOX / 2
        worst = 0.0
        for step in range(1, 120):
            t = step / 120
            u = 1 - t
            x = u**3 * half + 3 * u * u * t * (half + handle) + 3 * u * t * t * app_mark.BOX + t**3 * app_mark.BOX
            y = 3 * u * t * t * (half - handle) + t**3 * half
            across, down = abs(x - half), abs(y - half)
            radius = (across**app_mark.SQUIRCLE + down**app_mark.SQUIRCLE) ** (1 / app_mark.SQUIRCLE)
            worst = max(worst, abs(radius - half))
        self.assertLess(worst, 0.2)
        # A circular corner would need a much shorter handle, so this also shows
        # the tile is not simply a rounded rectangle.
        self.assertGreater(handle, half * 0.9)

    def test_the_pawn_is_three_inks_on_one_ground(self):
        self.assertEqual({app_mark.TILE, app_mark.INK, app_mark.RULE_INK}, {"#295e49", "#e5e4cf", "#a6bcae"})
        # The piece and the plate must not be the same ink, or the mark would
        # vanish; the rule is allowed to be quiet.
        self.assertNotEqual(app_mark.TILE, app_mark.INK)


if __name__ == "__main__":
    unittest.main()
