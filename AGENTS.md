# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds and quality checks. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

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
| repo doctrine (corpus / injection / compiler)  | `docs/08-repo-structure.md` |

The first four chapters are the spine every repository of the ecosystem carries — architecture, developing, testing, operating — and this repository's own gate refuses a tree that breaks it (`docs/06-quality-checks.md`, the Docs (layout) pass). The doctrine behind the spine is `jterrazz-studio`'s, routed to from `docs/08-repo-structure.md`.

One Claude Code skill routes into this corpus: `skills/jterrazz-typescript/SKILL.md` — what to run, what each failing pass means, the chapter to read next. It is hand-written, it never restates a chapter, and the Markdown (prose) pass fails it when it names a chapter that does not exist. The repo-structure doctrine itself is a separate skill, `jterrazz-repo-structure`, which now ships from `jterrazz-studio`.

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

## Setup

```bash
npm install
```

No build step — this package ships JS directly. It dogfoods its own CLI (`npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/
├── typescript.sh          # CLI entry (build, bundle, start, dev, docs-layout, doctor, baseline, tsc, check, fix, clean)
├── find-tsc.sh            # The TS7 Go compiler by platform — sourced by the CLI and by the check script
└── commands/
    └── check.sh           # Fourteen passes in parallel; each that RAN prints a header and a verdict, in one fixed order

lib/check-architecture.js  # The declared layer map against the resolved graph — the Architecture gate (dependency-cruiser)
lib/check-baseline.js      # The oxlint ratchet — counts that may fall and never rise; `typescript baseline` writes it
lib/check-drift.js         # How far the project stands from its profile — the drift report, `--json` for a machine
lib/check-docs.js          # The manual's shape, read off the repository's docs/ — the reader behind the Docs (layout) pass
lib/check-gitignore.js     # The artefact convention, read off the project's .gitignore — check | --fix
lib/check-markdown.js      # Every tracked page's coordinates and readability floors — the Markdown (prose) gate
lib/check-names.js         # What the tree calls its own parts — the Names (tree) gate
lib/check-publish.js       # The exports map against the tarball — the Publish gate (publint + attw)
lib/check-secrets.js       # No committed file carries a live credential — the Secrets gate (gitleaks, else patterns)
lib/check-suppressions.js  # Every disable directive is spelled, reasoned and live — the Suppressions gate, check | --fix

lib/doctor.js              # Installed tool versions against the declared ranges — `typescript doctor`
lib/entry-points.js        # The entries a build compiles, read off the consumer's own exports map
lib/merge-knip-config.js   # Merges knip base preset with project-local knip.json (read as JSONC)
lib/tracked-files.js       # The one sweep every tree gate starts from — git ls-files, or a walk where there is no git
lib/unsafe-fixers.js       # The rules `fix` must not let oxlint rewrite, as the flags that allow them for one run
lib/workspace-members.js   # Lists the consumer's workspace members — the unit each per-package gate measures from

rules/                     # The lint manifest — every rule of every loaded plugin decided by name
├── _contract.js           # fragment() / on() / off() / unsafeFix() — refuses an unreasoned decision, at load time
├── compile.js             # fragment -> the plain oxlint config object; `merge()` is the exported compose()
├── profiles.js            # Which fragments each of the seven profiles carries, and its ignore patterns
├── catalog.js             # The catalogue, rendered into the chapter's table and its fixer list
├── core/ · react.js · next.js · astro.js · a11y.js · bundler.js · vitest.js · sorted.js · react-native.js
└── architecture/          # hexagonal.js (the map this package ships) and layers.js (the builder)

presets/
├── tsconfig/ · tsdown/ · oxlint/profiles/ (the seven, compiled) · oxfmt/ · knip/ · prettier/ (.astro only)
src/index.js + index.d.ts  # Package entry — exports { oxfmt, oxlint } profiles (JS-shipped, no build)
src/oxlint.js · oxfmt.js   # The tool-facing entries — the profiles, compose(), layers(), each tool's defineConfig
src/docs.js + docs.d.ts    # The manual's rules, pure — auditDocs(tree), exported at ./docs for a second reader
docs/                      # The corpus: numbered chapters and decisions/
skills/                    # The Claude Code skill — one hand-written SKILL.md
specs/                     # Product specifications (@jterrazz/test) — the shape is docs/03-testing.md
```

## Commands

| Task                                    | Command                  |
| --------------------------------------- | ------------------------ |
| Run all tests                           | `npm test`               |
| Lint + format + typecheck + knip + docs | `npm run lint`           |
| Auto-fix lint issues                    | `npm run lint:fix`       |
| Regenerate every golden and projection  | `TEST_UPDATE=1 npm test` |

## Standing rule

A change to the public API updates `README.md`, the `docs/` chapters, and `skills/jterrazz-typescript/SKILL.md`. A change to a LINT DECISION is a line of a fragment under `rules/` and nothing else — the chapter's catalogue is its projection, regenerated with `TEST_UPDATE=1 npm test`. The repo-structure doctrine itself now lives in `jterrazz-studio` — never author it here or in a skill; route to it from `docs/08-repo-structure.md`.
