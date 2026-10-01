# Validate the actual commit message rather than a proposed subject.
import re
import subprocess
import sys

revision = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
message = subprocess.check_output(["git", "show", "-s", "--format=%B", revision], text=True).strip("\n")
lines = message.splitlines()
subject = lines[0] if lines else ""
pattern = r"(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore)(?:\([a-z0-9-]+\))?!?: [a-z].+"
valid = bool(re.fullmatch(pattern, subject)) and len(subject) <= 72 and not subject.endswith(".")
if len(lines) > 1:
    valid = valid and lines[1] == "" and all(len(line) <= 100 for line in lines[2:])
if not valid:
    sys.exit("Invalid Conventional Commit message")
print(f"Verified commit message: {subject}")
