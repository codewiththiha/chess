# Validate manual CI options and derive explicit prerequisite/full-suite decisions.
from dataclasses import dataclass
import html
import json
import os
from pathlib import Path

GATES = ("quality", "unit", "build", "browser", "commits")

@dataclass(frozen=True)
class Selection:
    gates: dict[str, bool]
    project: str
    grep: str
    unit_filter: str

    @property
    def build_required(self) -> bool:
        return self.gates["build"] or self.gates["browser"]

    @property
    def full_suite(self) -> bool:
        return (all(self.gates[key] for key in ("quality", "unit", "browser", "commits"))
                and self.project == "both" and not self.grep and not self.unit_filter)

    @property
    def projects(self) -> list[str]:
        return ["desktop", "mobile"] if self.project == "both" else [self.project]

    @property
    def expected(self) -> dict[str, bool]:
        return {"plan": True, **self.gates, "build": self.build_required}


def decode(value: object) -> Selection:
    if not isinstance(value, dict):
        raise ValueError("CI selection must be an object")
    gates = {}
    for key in GATES:
        flag = value.get(key, True)
        if not isinstance(flag, bool):
            raise ValueError(f"{key} must be a boolean, not a string")
        gates[key] = flag
    if not any(gates.values()):
        raise ValueError("Select at least one gate; an empty run is not verification")
    project = value.get("project", "both")
    if project not in ("both", "desktop", "mobile"):
        raise ValueError("project must be both, desktop, or mobile")
    grep = value.get("grep", "")
    unit_filter = value.get("unit_filter", "")
    for key, item, limit in (("grep", grep, 1024), ("unit_filter", unit_filter, 200)):
        if not isinstance(item, str) or len(item) > limit or "\x00" in item:
            raise ValueError(f"{key} must be text of at most {limit} characters")
    if unit_filter.startswith("-") or "\n" in unit_filter or "\r" in unit_filter:
        raise ValueError("unit_filter must be a file-name filter, not CLI flags")
    return Selection(gates, project, grep, unit_filter)


def load() -> Selection:
    return decode(json.loads(os.environ["CI_SELECTION_JSON"]))


def main() -> None:
    selection = load()
    outputs = {"build_required": str(selection.build_required).lower(),
               "projects": json.dumps(selection.projects)}
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as stream:
        for key, value in outputs.items():
            stream.write(f"{key}={value}\n")
    scope = "Full verification" if selection.full_suite else "Selected verification (partial)"
    lines = [f"## {scope}\n", "| Gate | Selection |", "| --- | --- |"]
    lines += [f"| {key} | {'run' if selected else 'skip'} |"
              for key, selected in selection.expected.items()]
    lines += [f"\nBrowser projects: {', '.join(selection.projects)}.",
              f"\nBrowser regex: <code>{html.escape(selection.grep or '(all)')}</code>.",
              f"\nUnit file filter: <code>{html.escape(selection.unit_filter or '(all)')}</code>."]
    if selection.gates["browser"] and not selection.gates["build"]:
        lines.append("\nProduction build is required by the selected browser tests.")
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as stream:
        stream.write("\n".join(lines) + "\n")
    print(scope)


if __name__ == "__main__":
    main()
