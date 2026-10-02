# Check authored-code hygiene and immutable engine/artwork provenance.
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
errors = []
verified_assets = 0
for directory in ["src", "tests", "scripts"]:
    for path in (root / directory).rglob("*"):
        if path.suffix not in {".ts", ".svelte", ".css", ".py", ".mjs"}:
            continue
        source = path.read_text()
        if not source.startswith(("//", "<!--", "/*", "#")):
            errors.append(f"{path.relative_to(root)} lacks a responsibility summary")
        if re.search(r"(?:@ts-ignore|@ts-nocheck|svelte-ignore|eslint-disable)", source) and path.name != "check_repo.py":
            errors.append(f"{path.relative_to(root)} suppresses a diagnostic")
for relative in ["public/engine/bridge-worker.mjs", "vite.config.ts", "vitest.config.ts", "playwright.config.ts", "svelte.config.js"]:
    if not (root / relative).read_text().startswith("//"):
        errors.append(f"{relative} lacks a responsibility summary")
for path in [root / "public/engine/manifest.json", root / "public/pieces/manifest.json"]:
    manifest = json.loads(path.read_text())
    if "backends" in manifest:
        for backend, entry in manifest["backends"].items():
            for filename, digest in entry["files"].items():
                asset = path.parent / backend / filename
                verified_assets += 1
                if hashlib.sha256(asset.read_bytes()).hexdigest() != digest:
                    errors.append(f"Engine checksum mismatch: {backend}/{filename}")
    else:
        for filename, entry in manifest["files"].items():
            verified_assets += 1
            if hashlib.sha256((path.parent / filename).read_bytes()).hexdigest() != entry["sha256"]:
                errors.append(f"Artwork checksum mismatch: {filename}")
# Platform icons are generated from public/favicon.svg by `npm run icons`, so
# they are not committed. What can be checked here is that the committed SVG is
# the one the generator produces, and that the bundle asks for the set the
# generator writes — including the .ico a Windows build compiles into the shell
# whether or not the bundle list names it.
sys.path.insert(0, str(root / "scripts"))
import app_mark

if (root / "public/favicon.svg").read_text() != app_mark.svg():
    errors.append("public/favicon.svg is not what scripts/app_mark.py draws")

GENERATED_ICONS = {
    "icons/32x32.png",
    "icons/64x64.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.png",
    "icons/icon.icns",
    "icons/icon.ico",
}
config = json.loads((root / "src-tauri/tauri.conf.json").read_text())
for name in sorted(set(config["bundle"]["icon"]) | {"icons/icon.ico", "icons/icon.icns"}):
    if name not in GENERATED_ICONS:
        errors.append(f"The desktop bundle names {name}, which the icon command does not write")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(
    "Authored-code summaries, the app mark, and "
    f"{verified_assets} vendored file checksums verified"
)
