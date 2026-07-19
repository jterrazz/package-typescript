# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds, quality checks, and API docs. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`. Do not duplicate it — link to it.

| Working on…                                   | Read                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup, tsconfig/oxlint/oxfmt wiring           | `docs/01-getting-started.md`                                                                                                                                        |
| build / bundle / start / dev                  | `docs/02-building.md`                                                                                                                                               |
| check / fix and their passes                  | `docs/03-quality-checks.md`                                                                                                                                         |
| oxlint presets, `compose`, architecture, knip | `docs/04-lint-presets.md`                                                                                                                                           |
| the `typescript docs` compiler                | `docs/05-docs-pipeline.md`                                                                                                                                          |
| repo doctrine (corpus / injection / compiler) | `docs/06-repo-structure.md` (stub) → [`jterrazz-studio` docs/08-repo-structure.md](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/08-repo-structure.md) |

`docs/reference/` is a **generated projection** — never hand-edit it (regenerate with `typescript docs`).

One Claude Code skill routes into this corpus: `skills/jterrazz-typescript/` (building, checking, linting, formatting, docs generation). It does not restate the corpus — it routes into it. The repo-structure doctrine itself is a separate skill, `jterrazz-repo-structure`, which now ships from `jterrazz-studio`.

## Setup

```bash
npm install
```

No build step — this package ships JS directly. It dogfoods its own CLI (`npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/
├── typescript.sh          # CLI entry (build, bundle, start, dev, docs [--check], check, fix)
└── commands/
    ├── check.sh           # Quality passes in parallel: tsc + oxlint + oxfmt + knip + (conventions) + (docs sync)
    └── docs.sh            # The docs compiler: typedoc reference tree, generate | --check
lib/merge-knip-config.js   # Merges knip base preset with project-local knip.json
presets/
├── tsconfig/ · tsdown/ · oxlint/ (+ architectures/hexagonal) · oxfmt/ · knip/
src/index.js + index.d.ts  # Package entry — exports { oxfmt, oxlint } presets (JS-shipped, no build)
docs/                      # The corpus: numbered chapters + the generated reference/ projection
specs/                     # Product specifications (@jterrazz/test) — see below
```

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler, pulled in via the per-platform `@typescript/typescript-*` optionalDependencies (resolved by path in `check.sh`). The regular `typescript` dependency stays on ^6 because typedoc (peer range 5–6) and eslint-plugin-perfectionist (bare `require('typescript')`) need the JS compiler API, which the Go package no longer ships. Never add `typescript@7` (or an npm alias of it) to the tree: under pnpm's hoist fallback it can hijack perfectionist's typescript lookup (`isExternalModuleNameRelative is not a function`), intermittently.

## Docs compiler internals

- `docs.sh` resolves the entry barrel as `src/index.ts`, else `src/index.d.ts` (this package is the JS-shipped case — its `tsconfig.json` includes `src/index.d.ts` so typedoc can read it).
- Output goes to a **committed** path under `docs/` (the reference tree), each file stamped with a `DO-NOT-EDIT` first line. Generation is deterministic (`LC_ALL=C`, `find | sort`, no timestamps) — two runs are byte-identical. Only `docs/reference/` is projected: it is the one cross-layer compile (source → docs); the chapters are authored corpus, not re-packaged into an `llms.txt` (that would be a same-layer presentation, and there is no delivery target for one here).
- `docs.sh --check` regenerates into a temp dir and diffs the committed reference tree without touching it; `check.sh` runs it as the **Docs (sync)** pass once `docs/reference/` exists.

## Self-lint ordering

`oxlint.config.ts` loads the `@jterrazz/test` ESM plugin via the exports map, and `check` type-checks `specs/` + `src/index.d.ts`. `npm run lint` is `typescript check` on this repo — it now includes the Docs (sync) pass on this repo's own committed `docs/`, the ultimate dogfood. Keep the committed docs in sync (regenerate on any corpus change) or lint fails.

## Specs (self-test)

`specs/cli/` drives the real product command through `specification.cli(bin/typescript.sh)` (CONVENTIONS B9 — never a tool underneath it). Layout C1': runners (`*.specification.ts`) at the facet root, tests in domain folders (`specs/cli/<domain>/<aspect>.test.ts`). Shared fixture projects in `specs/fixtures/` (reached via `.fixture('$FIXTURES/…')`); domain-local fixtures/goldens under `specs/cli/<domain>/`.

- `specs/cli/docs/` — the docs compiler: `generation.test.ts` (byte golden of the committed tree + header + enum sweep) and `sync.test.ts` (`docs --check` green/red + no-docs guard). Drift fixtures overlay `sample-documented` to tamper one file.
- `specs/cli/check/` — kitchen-sink whole-surface goldens (`check.txt`/`fix.txt`) + per-tool aspects; `docs-sync.test.ts` proves the Docs pass appears only when `docs/reference/` exists.
- Golden files (D11): full snapshots per use case, tokens for volatile parts, regenerate with `TEST_UPDATE=1`. `.grep()` is the scalpel for targeted probes.

## Commands

| Task                                         | Command                    |
| -------------------------------------------- | -------------------------- |
| Run all tests                                | `npm test`                 |
| Lint + format + typecheck + knip + docs sync | `npm run lint`             |
| Auto-fix lint issues                         | `npm run lint:fix`         |
| Regenerate docs projections                  | `./bin/typescript.sh docs` |

## Standing rule

A change to the corpus (README or a chapter) or the public API means **regenerate the projections in the same change** (`./bin/typescript.sh docs`) — the Docs (sync) pass will fail otherwise. A change to the public API also updates `README.md`, the `docs/` chapters, and `skills/jterrazz-typescript/`. The repo-structure doctrine itself now lives in `jterrazz-studio` — never author it here or in a skill; route to it from `docs/06-repo-structure.md`.
