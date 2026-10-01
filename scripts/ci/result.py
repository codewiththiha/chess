# Fail the aggregate check when selected gates fail, cancel, or unexpectedly skip.
import json
import os
from pathlib import Path
from selection import Selection, load


def evaluate(selection: Selection, value: object) -> tuple[list[str], list[str]]:
    if not isinstance(value, dict):
        raise ValueError("CI results must be an object")
    rows, failures = [], []
    for key, selected in selection.expected.items():
        job = value.get(key)
        result = job.get("result") if isinstance(job, dict) else "missing"
        if result not in ("success", "failure", "cancelled", "skipped", "missing"):
            result = "invalid"
        rows.append(f"| {key} | {'required' if selected else 'not selected'} | {result} |")
        if selected and result != "success":
            failures.append(f"{key}: required success, received {result}")
        elif not selected and result != "skipped":
            failures.append(f"{key}: unselected gate unexpectedly received {result}")
    return rows, failures


def main() -> None:
    selection = load()
    rows, failures = evaluate(selection, json.loads(os.environ["CI_RESULTS_JSON"]))
    scope = "Full verification" if selection.full_suite else "Selected verification (partial)"
    text = [f"## {scope} result", "", "| Gate | Requirement | Result |", "| --- | --- | --- |", *rows]
    text.append("\nFailed selected gates." if failures else "\nEvery selected gate passed.")
    if not selection.full_suite:
        text.append("\nThis partial run is not the required Full verification status.")
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as stream:
        stream.write("\n".join(text) + "\n")
    if failures:
        raise SystemExit("\n".join(failures))
    print(scope + ": passed")


if __name__ == "__main__":
    main()
