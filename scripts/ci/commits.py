# Select actual push/PR source commits and reuse the Conventional Commit validator.
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ZERO = "0" * 40


def sha(value: object) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("GitHub event contains an invalid commit SHA")
    return value


def revision_range(event: str, payload: object) -> str:
    if not isinstance(payload, dict):
        raise ValueError("GitHub event payload must be an object")
    if event == "pull_request":
        pr = payload.get("pull_request")
        if not isinstance(pr, dict):
            raise ValueError("Missing pull request metadata")
        base, head = pr.get("base"), pr.get("head")
        if not isinstance(base, dict) or not isinstance(head, dict):
            raise ValueError("Missing pull request commit metadata")
        return f"{sha(base.get('sha'))}..{sha(head.get('sha'))}"
    if event == "push":
        before, after = sha(payload.get("before")), sha(payload.get("after"))
        return after if before == ZERO else f"{before}..{after}"
    return "HEAD^..HEAD"


def main() -> None:
    payload = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    event = os.environ["GITHUB_EVENT_NAME"]
    selected = revision_range(event, payload)
    if event not in ("push", "pull_request"):
        revisions = ["HEAD"]
    else:
        revisions = subprocess.check_output(
            ["git", "rev-list", "--reverse", "--no-merges", selected], text=True
        ).splitlines()
    if not revisions:
        raise SystemExit("No source commits were selected for validation")
    validator = Path(__file__).resolve().parents[1] / "check_commit.py"
    for revision in revisions:
        subprocess.run([sys.executable, str(validator), revision], check=True)
    print(f"Validated {len(revisions)} actual source commit(s)")


if __name__ == "__main__":
    main()
