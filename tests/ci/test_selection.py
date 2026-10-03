# Prove full/partial classification, prerequisite selection, and failure propagation.
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/ci"))
from selection import decode
from result import evaluate
from commits import revision_range, source_commits, ZERO


def options(**changes: object) -> dict[str, object]:
    return {"quality": True, "unit": True, "build": True, "browser": True,
            "commits": True, "project": "both", "grep": "", "unit_filter": "", **changes}


def results(selection) -> dict[str, dict[str, str]]:
    return {key: {"result": "success" if selected else "skipped"}
            for key, selected in selection.expected.items()}


class SelectionTests(unittest.TestCase):
    def test_defaults_are_full(self):
        selection = decode({})
        self.assertTrue(selection.full_suite)
        self.assertEqual(selection.projects, ["desktop", "mobile"])

    def test_unchecking_build_does_not_remove_browser_prerequisite(self):
        selection = decode(options(build=False))
        self.assertTrue(selection.build_required)
        self.assertTrue(selection.full_suite)

    def test_build_can_really_skip_without_browser(self):
        selection = decode(options(build=False, browser=False))
        self.assertFalse(selection.build_required)
        self.assertFalse(selection.full_suite)

    def test_mobile_only_is_partial(self):
        selection = decode(options(project="mobile"))
        self.assertEqual(selection.projects, ["mobile"])
        self.assertFalse(selection.full_suite)

    def test_filters_make_a_run_partial(self):
        self.assertFalse(decode(options(grep="review|promotion")).full_suite)
        self.assertFalse(decode(options(unit_filter="database")).full_suite)

    def test_false_string_is_not_a_boolean(self):
        with self.assertRaises(ValueError):
            decode(options(browser="false"))

    def test_empty_selection_is_not_successful_verification(self):
        with self.assertRaises(ValueError):
            decode(options(**{key: False for key in ("quality", "unit", "build", "browser", "commits")}))

    def test_invalid_projects_and_cli_flags_are_rejected(self):
        for changes in ({"project": "webkit"}, {"unit_filter": "--passWithNoTests"}, {"grep": "x" * 1025}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                decode(options(**changes))

    def test_success_and_intentional_skips_are_accepted(self):
        selection = decode(options(browser=False, build=False))
        self.assertEqual(evaluate(selection, results(selection))[1], [])

    def test_failure_cancel_and_unexpected_skip_cannot_pass(self):
        selection = decode(options())
        for status in ("failure", "cancelled", "skipped"):
            value = results(selection)
            value["browser"]["result"] = status
            with self.subTest(status=status):
                self.assertEqual(len(evaluate(selection, value)[1]), 1)

    def test_missing_plan_and_unexpected_job_are_failures(self):
        selection = decode(options(unit=False))
        value = results(selection)
        del value["plan"]
        value["unit"]["result"] = "success"
        self.assertEqual(len(evaluate(selection, value)[1]), 2)

    def test_push_range_and_first_push_history(self):
        a, b = "a" * 40, "b" * 40
        self.assertEqual(revision_range("push", {"before": a, "after": b}), f"{a}..{b}")
        self.assertEqual(revision_range("push", {"before": ZERO, "after": b}), b)

    def test_pr_checks_source_head_not_synthetic_merge(self):
        a, b = "a" * 40, "b" * 40
        self.assertEqual(revision_range("pull_request", {"pull_request": {"base": {"sha": a}, "head": {"sha": b}}}), f"{a}..{b}")

    def test_invalid_commit_metadata_is_rejected(self):
        with self.assertRaises(ValueError):
            revision_range("push", {"before": "HEAD; echo bad", "after": "b" * 40})


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


class SourceCommitTests(unittest.TestCase):
    """The range walk in a throwaway repository, walked exactly as the gate does."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        here = os.getcwd()
        self.addCleanup(os.chdir, here)
        os.chdir(temporary.name)
        git("init", "-q")
        git("config", "user.name", "ci")
        git("config", "user.email", "ci@example.com")
        Path("board.txt").write_text("one\n")
        git("add", "board.txt")
        git("commit", "-qm", "first")
        Path("board.txt").write_text("two\n")
        git("commit", "-aqm", "second")

    def test_a_walkable_range_names_its_commits(self):
        head = git("rev-parse", "HEAD")
        self.assertEqual(source_commits(f"{git('rev-parse', 'HEAD^')}..{head}"), [head])

    def test_a_force_pushed_base_falls_back_to_the_commit_that_landed(self):
        # The event names the commit the branch pointed at before the push; after
        # a force push it is gone, and no range can be walked from it.
        head = git("rev-parse", "HEAD")
        self.assertEqual(source_commits(f"{'0' * 40}..{head}"), [head])


if __name__ == "__main__":
    unittest.main()
