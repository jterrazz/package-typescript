# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds, quality checks, and API docs. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`, mapped by `docs/README.md`. Decisions this package alone took are in `docs/decisions/`. Do not duplicate it — link to it.

| Working on…                                    | Read                        |
| ---------------------------------------------- | --------------------------- |
| the layers, the exports map, the two compilers | `docs/01-architecture.md`   |
| setup, tsconfig/oxlint/oxfmt wiring, this repo | `docs/02-developing.md`     |
| the specs, the fixtures, the self-lint         | `docs/03-testing.md`        |
| the release, and which number moves            | `docs/04-operating.md`      |
| build / bundle / start / dev                   | `docs/05-building.md`       |
| check / fix and their passes                   | `docs/06-quality-checks.md` |
| oxlint presets, `compose`, architecture, knip  | `docs/07-lint-presets.md`   |
| the `typescript docs` compiler                 | `docs/08-docs-pipeline.md`  |
| repo doctrine (corpus / injection / compiler)  | `docs/09-repo-structure.md` |

The first four chapters are the spine every repository of the ecosystem carries — architecture, developing, testing, operating — and this repository's own gate refuses a tree that breaks it (`docs/06-quality-checks.md`, the Docs (layout) pass). The doctrine behind the spine is `jterrazz-studio`'s, routed to from `docs/09-repo-structure.md`.

`docs/reference/` is a **generated projection** — never hand-edit it (regenerate with `typescript docs`).

One Claude Code skill routes into this corpus: `skills/jterrazz-typescript/` (building, checking, linting, formatting, docs generation). It does not restate the corpus — it routes into it. The repo-structure doctrine itself is a separate skill, `jterrazz-repo-structure`, which now ships from `jterrazz-studio`.

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

## Setup

```bash
npm install
```

No build step — this package ships JS directly. It dogfoods its own CLI (`npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/
├── typescript.sh          # CLI entry (build, bundle, start, dev, docs [--check], docs-layout, check, fix, clean)
└── commands/
    ├── check.sh           # Quality passes in parallel: tsc + oxlint + oxfmt + (gitignore) + knip + (conventions) + (docs layout) + (docs sync)
    └── docs.sh            # The docs compiler: typedoc reference tree, generate | --check
lib/check-docs.js          # The manual's shape, read off the repository's docs/ — the reader behind the Docs (layout) pass
lib/check-gitignore.js     # The artefact convention, read off the project's .gitignore — check | --fix
lib/merge-knip-config.js   # Merges knip base preset with project-local knip.json (read as JSONC)
lib/workspace-members.js   # Lists the consumer's workspace members — the unit each per-package gate measures from
presets/
├── tsconfig/ · tsdown/ · oxlint/ (+ architectures/hexagonal) · oxfmt/ · knip/
src/index.js + index.d.ts  # Package entry — exports { oxfmt, oxlint } presets (JS-shipped, no build)
src/oxlint.js · oxfmt.js   # The tool-facing entries — presets, compose(), and each tool's defineConfig
src/docs.js + docs.d.ts    # The manual's rules, pure — auditDocs(tree), exported at ./docs for a second reader
docs/                      # The corpus: numbered chapters + the generated reference/ projection
specs/                     # Product specifications (@jterrazz/test) — the shape is docs/03-testing.md
```

## Commands

| Task                                    | Command                    |
| --------------------------------------- | -------------------------- |
| Run all tests                           | `npm test`                 |
| Lint + format + typecheck + knip + docs | `npm run lint`             |
| Auto-fix lint issues                    | `npm run lint:fix`         |
| Regenerate docs projections             | `./bin/typescript.sh docs` |

## Standing rule

A change to the corpus (README or a chapter) or the public API means **regenerate the projections in the same change** (`./bin/typescript.sh docs`) — the Docs (sync) pass will fail otherwise. A change to the public API also updates `README.md`, the `docs/` chapters, and `skills/jterrazz-typescript/`. The repo-structure doctrine itself now lives in `jterrazz-studio` — never author it here or in a skill; route to it from `docs/09-repo-structure.md`.
