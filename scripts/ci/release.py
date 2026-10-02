# Check the tag being released against the version the app was built with.
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "src-tauri/tauri.conf.json"
VERSION = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?")


def read_version(config: Path) -> str:
    """The version the bundles will carry, taken from the Tauri configuration."""
    version = json.loads(config.read_text()).get("version")
    if not isinstance(version, str) or not VERSION.fullmatch(version):
        raise SystemExit(f"{config.name} does not carry a release version.")
    return version


def check(tag: str, version: str) -> bool:
    """Refuse a tag that does not name this version; report pre-releases."""
    expected = f"v{version}"
    if tag != expected:
        raise SystemExit(
            f"Tag {tag!r} does not name version {version!r}; release as {expected!r}."
        )
    return "-" in version


def main() -> None:
    config = Path(os.environ.get("TAURI_CONFIG") or DEFAULT_CONFIG)
    tag = os.environ.get("RELEASE_TAG", "").strip()
    if not tag:
        raise SystemExit("RELEASE_TAG must name the tag being released.")
    version = read_version(config)
    prerelease = check(tag, version)
    outputs = {
        "tag": tag,
        "version": version,
        "prerelease": str(prerelease).lower(),
    }
    destination = os.environ.get("GITHUB_OUTPUT")
    if destination:
        with Path(destination).open("a") as stream:
            for key, value in outputs.items():
                stream.write(f"{key}={value}\n")
    kind = "pre-release" if prerelease else "release"
    print(f"Publishing {tag} as a {kind} of version {version}")


if __name__ == "__main__":
    main()
