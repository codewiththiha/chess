# Third-party notices

Authored frontend code is GPL-3.0-or-later. This file identifies separately
licensed components; it does not replace their complete license texts. Retain
`LICENSE`, `public/licenses`, both engine-package notices, and the provenance
manifests when distributing this project or its static build.

## Rust-built engine and models

- **gwaymaegyi 0.1.0** — copyright 2026 codewiththiha, MIT.
- **Bundled models** — copyright 2024 Adam Kulju, MIT, as stated in the model notice.
- Source revision: `4e2af5f068e49bf83fe5f1522636c985355b114a`.
- Source: https://github.com/codewiththiha/gwaymaegyi/tree/4e2af5f068e49bf83fe5f1522636c985355b114a
- CI provenance: https://github.com/codewiththiha/gwaymaegyi/actions/runs/36887255210
- Portable artifact: `11174513479`; SIMD128 artifact: `11174653953`.
- Each package retains `LICENSE` and `MODEL-LICENSE`; all 22 vendored files are
  SHA-256 recorded in `public/engine/manifest.json`.

The engine packages are unchanged. The thin authored discovery bridge is part
of the GPL-compatible frontend, not a relicensing of the MIT engine/models.
Consult upstream source and notices for engine dependency provenance.

## SVG chess pieces

These are real, individually downloaded SVGs—not proprietary Chess.com artwork
and not AI-generated approximations. The inventory and complete licenses are
retained under `public/licenses`.

| In-app name | Set        | Creator             | License          | Retained text             |
| ----------- | ---------- | ------------------- | ---------------- | ------------------------- |
| Chessnut    | `chessnut` | Alexis Luengas      | Apache-2.0       | `Chessnut-Apache-2.0.txt` |
| Celtic      | `celtic`   | Maurizio Monge      | MIT              | `Celtic-MIT.txt`          |
| Classic     | `cburnett` | Colin M. L. Burnett | GPL-2.0-or-later | `GPL-2.0.txt`             |

Immediate source is the Lichess artwork distribution at pinned revision
`0b3a2610c602009378b8193b19cf88d8c9fb3d19`:
https://github.com/lichess-org/lila/tree/0b3a2610c602009378b8193b19cf88d8c9fb3d19/public/piece

Every one of the 36 SVGs has its exact download URL and SHA-256 digest in
`public/pieces/manifest.json`. Attribution inventory:
`public/licenses/Lichess-artwork-inventory.md`. Original creator repositories
include https://github.com/LexLuengas/chessnut-pieces and
https://github.com/maurimo/chess-art.

GPLv2-or-later artwork can be distributed in the GPLv3-or-later combined project.
Apache-2.0 and MIT notices are retained separately. Non-commercial-only piece sets
are intentionally not included. No modification of the downloaded piece artwork
is claimed; board finishes/layout are authored frontend styles.

## Runtime libraries and CSS

Versions are pinned in `package.json`/`package-lock.json`; complete direct-runtime
license texts are copied to `public/licenses` so the static distribution retains
them without relying on a package-manager installation.

| Component                     | License          | Retained text             |
| ----------------------------- | ---------------- | ------------------------- |
| Svelte                        | MIT              | `Svelte-MIT.txt`          |
| @lichess-org/chessground      | GPL-3.0-or-later | `Chessground-GPL-3.0.txt` |
| chessops                      | GPL-3.0-or-later | `chessops-GPL-3.0.txt`    |
| @badrap/result                | MIT              | `Badrap-result-MIT.txt`   |
| Dexie                         | Apache-2.0       | `Dexie-Apache-2.0.txt`    |
| Lucide icons / @lucide/svelte | ISC              | `Lucide-ISC.txt`          |
| Tailwind CSS                  | MIT              | `Tailwind-MIT.txt`        |
| daisyUI                       | MIT              | `daisyUI-MIT.txt`         |

Build/test tools remain declared with integrity metadata in the npm lockfile.
Their original package notices remain applicable. Exact transitive dependency
inventory is the committed lockfile, not a hand-maintained version guess.

## Self-hosted fonts

DM Sans, Newsreader, and DM Mono retain their SIL Open Font License notices:
`dm-sans-OFL.txt`, `newsreader-OFL.txt`, and `dm-mono-OFL.txt`. They are supplied
through the corresponding Fontsource packages, pinned in the npm lockfile, and
bundled as own-origin font files. The retained texts identify the typeface
copyright holders and reserved-name terms. No renamed/modified typeface is claimed.

## Source availability

The GPL-3.0-or-later frontend choice covers the combined Chessground/chessops
application. It does not erase MIT, Apache, ISC, GPLv2-or-later, or OFL notices.
When distributing or hosting, provide the actual corresponding frontend source,
its build inputs/lockfile, and notices, and make the source location accessible to
users. The in-app Help dialog describes this obligation and exposes license and
provenance links. Initial delivery remains local only; there is no public frontend
repository location to falsely advertise.

Research links/design inspiration are documented in `docs/research.md`. The
project's design skill is original guidance, not a copied external skill or an
imported set of instructions.
