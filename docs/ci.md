# CI workflows and selective verification

Source repository: https://github.com/codewiththiha/chess
Actions: https://github.com/codewiththiha/chess/actions

## Defaults and workflow ownership

`.github/workflows/ci.yml` runs **the full suite on every branch push and pull
request**, except pushes that only touch `docs/**` or Markdown, which cannot
change the app. Its Run workflow form supports deliberately smaller manual runs.
`.github/workflows/verify.yml` is a reusable workflow containing the actual jobs.
The shared `.github/actions/node-environment/action.yml` selects `.node-version`
and runs `npm ci` against the committed lockfile. These jobs compile no Rust;
unit/browser jobs execute the existing checksum-recorded WASM packages.
`.github/workflows/desktop.yml` is a separate workflow for the Tauri shell, so a
frontend run never waits on a Rust toolchain and a shell failure never hides the
web gates.

Automatic events ignore manual filter/skip settings and run every gate. There are
no changed-file heuristics, hidden commit-message bypasses, or `continue-on-error`
passes. Manual selections are explicit and summarized in the run. Selecting
nothing is an error, not a green check.

| Job                        | What it does                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Selection                  | Validates typed booleans, project/filter bounds, and build prerequisites                 |
| Quality                    | Strict Svelte/TS, oxlint/provenance, Prettier, 28 CI-script regression tests, actionlint |
| Unit and WASM              | Vitest unit/integration suite, including the real Portable/SIMD128 binaries              |
| Production build           | Vite build; uploads the production output used by browser jobs                           |
| Browser (desktop/mobile)   | Independent jobs test the same downloaded production build with Chromium                 |
| Commit messages            | Validates actual source commits rather than GitHub's synthetic PR merge message          |
| Full/Selected verification | Fails on any selected gate's failure, cancellation, or unexpected skip                   |

The `Browser (mobile)` job runs the phone-relevant specs plus `compact.spec.ts`,
which holds the one-screen contract: no page scroll on Home, play, or study; the
board, its players, the ply control, the current review sentence, and the rail
all inside the viewport; five-column move rows; and the sheet behind the menu
button. The specs that drive the study card's content step by step stay on the
desktop project, because on a phone that content lives in that sheet.

The `Desktop` workflow builds `npm run build`, checks `cargo fmt`, runs
`cargo clippy` with warnings denied, compiles the shell with `--locked` against
the committed `Cargo.lock`, and uploads the binary. It triggers on pushes that
touch the frontend or `src-tauri/`, on pull requests, and by manual dispatch,
which can additionally produce `deb`, `rpm`, and `appimage` bundles. Only that
workflow is evidence for desktop compilation; the web gates say nothing about it.

`.github/workflows/release.yml` publishes a release from a version tag: desktop
bundles for Linux, macOS (arm64 and Intel), and Windows, Android APKs for every
architecture plus a universal APK and an AAB, and a web tarball. It never runs on
branch pushes, it is the only workflow that asks for `contents: write`, and
[releases.md](releases.md) documents the tags, the Android signing secrets, and
how to extend the matrix.

The browser projects use one Playwright worker each, no retries, and independent
runners; one project's failure does not cancel the other. A build failure prevents
browser execution and still fails the aggregate result. CI rejects accidental
`test.only`. A filter matching no tests fails rather than silently passing.

## Select jobs in GitHub's UI

1. Open **Actions → CI → Run workflow**.
2. Choose a branch containing the workflow files.
3. Leave the default selections for a complete run, or uncheck unneeded gates.
4. Optionally choose a browser project or test/file filter, then run.
5. Inspect the Selection and final verification summaries to see exactly what ran.

| Input         | Default | Manual behavior                                                                |
| ------------- | ------- | ------------------------------------------------------------------------------ |
| `quality`     | true    | Type/lint/format/workflow/CI-script checks                                     |
| `unit`        | true    | Unit and actual-WASM tests                                                     |
| `build`       | true    | Standalone production build                                                    |
| `browser`     | true    | Playwright tests; **requires a production build even if `build` is unchecked** |
| `commits`     | true    | Conventional Commit validation                                                 |
| `project`     | both    | `both`, `desktop`, or `mobile`                                                 |
| `grep`        | empty   | Playwright test-title regular expression, maximum 1,024 characters             |
| `unit_filter` | empty   | Vitest file-name substring/path, maximum 200 characters; not CLI flags         |

Examples:

- **Quick code checks:** quality + unit on; build/browser/commits off.
- **One clock regression:** unit on, other gates off, `unit_filter=clocks-review`.
- **Phone promotion checks:** browser on, other gates off, project mobile,
  `grep=promotion`. The production build runs as its prerequisite.
- **Docs/workflow changes:** quality + commits on; unit/build/browser off.
- **Artifact only:** build on, other gates off. This confirms compilation only,
  not type checks or engine/browser correctness.

Checking all meaningful gates, both projects, and empty filters produces
**Full verification**. If browser tests are selected, unchecking standalone build
still executes that required build and does not reduce coverage. Any other reduced
selection/filter produces **Selected verification**, clearly marked partial.

## GitHub CLI examples

Install/authenticate GitHub CLI locally with your own credential manager. No PAT
is required in repository files or workflow secrets. Use `-R` so these examples
work outside a checkout:

```sh
# Complete run with all defaults.
gh workflow run ci.yml -R codewiththiha/chess --ref main

# Types/lint/format and unit tests only.
gh workflow run ci.yml -R codewiththiha/chess --ref main \
  -f quality=true -f unit=true -f build=false -f browser=false -f commits=false

# Targeted mobile browser tests; build remains a required prerequisite.
gh workflow run ci.yml -R codewiththiha/chess --ref main \
  -f quality=false -f unit=false -f build=false -f browser=true -f commits=false \
  -f project=mobile -f 'grep=promotion|Chess960'

# Only the persistence-related Vitest file(s).
gh workflow run ci.yml -R codewiththiha/chess --ref main \
  -f quality=false -f unit=true -f build=false -f browser=false -f commits=false \
  -f unit_filter=persistence

# Find the actual run ID, watch it, or view failure output.
gh run list -R codewiththiha/chess --workflow ci.yml --limit 5
gh run watch RUN_ID -R codewiththiha/chess --exit-status
gh run view RUN_ID -R codewiththiha/chess --log-failed
```

Replace `RUN_ID` with the numeric ID returned by GitHub. A manual workflow must
exist on the repository's default branch before the UI/API can dispatch it.
Other refs must contain compatible caller/reusable workflow files. Do not place
shell commands in filter fields: values are passed as quoted arguments, not `eval`.

## Reuse from a future workflow

Call the repository-local reusable workflow, keeping read-only permissions:

```yaml
name: Targeted regression
on: workflow_dispatch
permissions:
  contents: read
jobs:
  verify:
    uses: ./.github/workflows/verify.yml
    with:
      quality: false
      unit: true
      build: false
      browser: false
      commits: false
      unit_filter: clocks-review
```

Inputs use native boolean types, not quoted `"false"` strings. Reusable callers
get the same validation, prerequisite handling, and full-versus-partial result.
If calling across repositories, use a reviewed immutable commit SHA rather than
a moving branch. Workflow syntax reference:
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Reports and artifacts

Each browser job uploads `playwright-PROJECT-ATTEMPT` containing:

- `playwright-report/`: browsable HTML report;
- `test-results/results.xml`: JUnit result summary;
- retained failure traces and attachments under `test-results/`.

Download via the run's **Artifacts** section or:

```sh
gh run download RUN_ID -R codewiththiha/chess \
  -n playwright-mobile-1 -D ci-artifacts/mobile
npx playwright show-report ci-artifacts/mobile/playwright-report
```

Change the project/attempt suffix to the actual artifact name. Reports upload
on success/failure when the job is not cancelled; a very early setup failure may
produce no report. The production artifact is
`production-RUN_ID-RUN_ATTEMPT`. Retention is **7 days**, not a permanent backup.
The build artifact is static output, not an automatic deployment or the complete
corresponding source; retain the repository source/licenses when distributing it.

## Required checks and safe skips

For a branch ruleset, require the **Full verification** check emitted by the
`Verify` caller (typically `Verify / Full verification`; confirm the exact name
in the first successful run). Do not require a particular browser matrix child,
which intentionally may not exist in manual selections. More importantly, do not
use **Selected verification** as the sole merge gate: a partial run cannot replace
complete coverage. The full and selected aggregate jobs have different check
names, so a green targeted run does not impersonate a full one.

This repository's workflow defines checks but **does not silently change GitHub
branch-protection settings**. Configure the desired ruleset in repository Settings.
Avoid GitHub-wide `[skip ci]` messages/path exclusions for protected changes: they
can leave required checks pending rather than producing a useful partial result.

## Local equivalents and debugging

Use Node 24+ and Python 3. `npm run verify` includes CI-script regression tests;
`npm run verify:all` additionally lints workflows and runs both browser projects.

```sh
npm ci
npm run test:ci
npm run lint:workflows
npm run verify:all

# Reuse a freshly built app without rebuilding it inside Playwright.
npm run build
PLAYWRIGHT_PREBUILT=1 npm run test:e2e -- --project=mobile --grep='promotion|Chess960'

# Isolate a CI-style server/report run from an existing port 5173 preview.
CI=true PLAYWRIGHT_PREBUILT=1 PLAYWRIGHT_PORT=5174 \
  npm run test:e2e -- --project=desktop
```

Do not set `PLAYWRIGHT_PREBUILT=1` without a fresh `dist` build. An alternate port
must be an integer from 1024 to 65535. CI never reuses an existing server; local
runs can reuse the configured preview. Clear the filter and rerun both projects
before treating a targeted fix as completely verified.

Commit validation checks non-merge commits in the push's before/after range, all
history on an initial push, the PR base/head range for pull requests, and HEAD for
manual runs. Normal checkout defaults can point to synthetic PR merges, which
is why the source range is selected explicitly. Conventional squash subjects
still need to satisfy the project's commit rules.

## Security and upgrades

- Workflows request only `contents: read`, use `pull_request` rather than
  privileged `pull_request_target`, and do not inherit repository secrets.
- Checkout does not persist credentials. Actions use built-in short-lived runtime
  credentials for artifacts; no personal token is injected into npm/test jobs.
- Official actions are pinned to reviewed release commit SHAs (release labels
  are comments). Update the SHA and version comment together after inspection.
- actionlint 1.7.12 is checksum-pinned for Linux amd64/arm64 in
  `scripts/ci/actionlint.json`; its downloader verifies the archive before running.
  Updating it requires reviewing the release and replacing its version/URL/digest
  together. Other local OSes can run a separately installed actionlint directly.
- npm cache stores dependency downloads, not trusted `node_modules`; every job
  reinstalls the locked dependencies. Browser versions come from pinned Playwright.
- Use least-privilege repository credentials to push workflow changes (Contents
  and Workflows write are needed), never put them in tracked URLs/configuration.

Official Playwright CI guidance: [5](https://playwright.dev/docs/ci). Action release
links are available at the corresponding `actions/*` GitHub repositories. Hosting
and GitHub Pages deployment are not side effects of these test workflows; release
publication belongs to `release.yml`, described in [releases.md](releases.md).

## First-publication proof

The [full push run](https://github.com/codewiththiha/chess/actions/runs/36916203038)
and [selective mobile run](https://github.com/codewiththiha/chess/actions/runs/36916345995)
both passed for commit `0e455d8`. The latter intentionally skipped quality/unit/commit
jobs, ran the required build, passed its two filtered scenarios, and emitted only
`Verify / Selected verification`. The full run emitted `Verify / Full verification`
and passed all 55 app + 14 CI-script + 48 browser tests. See
[verification evidence](verification.md) for exact scope; use Actions history to
check newer commits rather than treating historical success as current proof.
