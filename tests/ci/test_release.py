# Prove a release tag has to name the version the app was built with.
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/ci"))
from release import check, read_version


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.config = Path(directory.name) / "tauri.conf.json"

    def write(self, version: object) -> None:
        self.config.write_text(json.dumps({"version": version}))

    def test_tag_must_name_the_version(self):
        self.write("1.2.3")
        version = read_version(self.config)
        self.assertFalse(check("v1.2.3", version))
        with self.assertRaises(SystemExit):
            check("v1.2.4", version)
        with self.assertRaises(SystemExit):
            check("1.2.3", version)

    def test_pre_release_versions_are_flagged(self):
        self.write("1.2.3-rc.1")
        version = read_version(self.config)
        self.assertTrue(check("v1.2.3-rc.1", version))

    def test_unusable_versions_are_refused(self):
        for value in ("", "latest", "v1.2.3", 3, None):
            with self.subTest(value=value):
                self.write(value)
                with self.assertRaises(SystemExit):
                    read_version(self.config)

    def test_the_two_version_files_agree(self):
        package = json.loads((ROOT / "package.json").read_text())["version"]
        self.assertEqual(package, read_version(ROOT / "src-tauri/tauri.conf.json"))


if __name__ == "__main__":
    unittest.main()
