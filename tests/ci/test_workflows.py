# Keep a release dry run unable to publish, and the guards that say so in place.
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github/workflows"
RELEASE = WORKFLOWS / "release.yml"

# A step that must only run when the run is a real release, and the step that
# collects the same artifacts when it is a dry run.
GUARDED_STEPS = [
    ("Open the release every job uploads to", True),
    ("Publish the Android builds", True),
    ("Publish the web bundle", True),
    ("Keep the Android builds", False),
    ("Keep the web bundle", False),
]


class WorkflowGuardTests(unittest.TestCase):
    def test_no_expression_falls_through_an_empty_string(self):
        # `condition && '' || tag` evaluates to `tag`, because an empty string
        # is falsy in a GitHub expression. That idiom once handed the release
        # tag to a dry run, which published a desktop bundle nobody asked for.
        for path in sorted(WORKFLOWS.glob("*.yml")):
            with self.subTest(workflow=path.name):
                self.assertNotRegex(path.read_text(), r"&&\s*''\s*\|\|")

    def test_the_build_jobs_are_told_the_release_tag(self):
        text = RELEASE.read_text()
        self.assertIn("tagName: ${{ needs.plan.outputs.release_tag }}", text)
        self.assertIn('echo "release_tag=" >> "$GITHUB_OUTPUT"', text)

    def test_only_a_real_release_publishes(self):
        text = RELEASE.read_text()
        for name, publishes in GUARDED_STEPS:
            with self.subTest(step=name):
                comparison = "!=" if publishes else "=="
                self.assertRegex(
                    text,
                    rf"name: {re.escape(name)}\n\s+if: [^\n]*release_tag {comparison} ''",
                )


if __name__ == "__main__":
    unittest.main()
