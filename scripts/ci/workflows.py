# Run a release/checksum-pinned actionlint binary without trusting an installer pipe.
import hashlib
import io
import json
from pathlib import Path
import platform
import subprocess
import tarfile
import tempfile
import urllib.request


def main() -> None:
    config = json.loads(Path(__file__).with_name("actionlint.json").read_text())
    arch = {"x86_64": "amd64", "aarch64": "arm64"}.get(platform.machine())
    if platform.system() != "Linux" or arch is None:
        raise SystemExit("This pinned runner supports Linux amd64/arm64; use actionlint locally on other systems.")
    artifact = config["linux"][arch]
    with urllib.request.urlopen(artifact["url"], timeout=60) as response:
        archive = response.read(20_000_001)
    if len(archive) > 20_000_000 or hashlib.sha256(archive).hexdigest() != artifact["sha256"]:
        raise SystemExit("actionlint download did not match the pinned SHA-256")
    with tempfile.TemporaryDirectory(prefix="chess-actionlint-") as directory:
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
            member = bundle.getmember("actionlint")
            if not member.isfile() or member.size > 30_000_000:
                raise SystemExit("Invalid actionlint release archive")
            content = bundle.extractfile(member)
            if content is None:
                raise SystemExit("Missing actionlint executable")
            executable = Path(directory) / "actionlint"
            executable.write_bytes(content.read())
            executable.chmod(0o700)
        subprocess.run([str(executable), "-color"], check=True,
                       cwd=Path(__file__).resolve().parents[2])
    print(f"Workflows passed actionlint {config['version']}")


if __name__ == "__main__":
    main()
