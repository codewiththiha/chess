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
# Windows builds compile the resource file from icons/icon.ico, whether or not
# the bundle list names it, so a missing icon only shows up on a Windows runner.
config = json.loads((root / "src-tauri/tauri.conf.json").read_text())
for name in sorted({*config["bundle"]["icon"], "icons/icon.ico"}):
    if not (root / "src-tauri" / name).is_file():
        errors.append(f"The desktop bundle names {name}, which is not in the repository")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(f"Authored-code summaries, the desktop icons, and {verified_assets} vendored file checksums verified")
