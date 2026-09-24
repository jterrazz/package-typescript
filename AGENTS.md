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
make install
```

No build step — this package ships JS directly. It dogfoods its own CLI (`make lint` → `npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/
├── typescript.sh             # CLI entry (build, bundle, start, dev, docs-layout, doctor, baseline, tsc, check, fix, clean)
├── find-tsc.sh               # The TS7 Go compiler by platform — sourced by the CLI and by the check script
├── tool-configs.sh           # The config oxlint and oxfmt run with — the project's own, else the default — sourced by the same two
└── commands/
    └── check.sh              # Fourteen passes in parallel; each that RAN prints a header and a verdict, in one fixed order

src/cli/check-architecture.js # The declared layer map against the resolved graph — the Architecture gate (dependency-cruiser)
src/cli/check-baseline.js     # The oxlint ratchet — exact counts; `fix` re-records what fell, `typescript baseline` writes it
src/cli/check-drift.js        # How far the project stands from its profile — the drift report, `--json` for a machine
src/cli/check-docs.js         # The manual's shape, read off the repository's docs/ — the reader behind the Docs (layout) pass
src/cli/check-gitignore.js    # The artefact convention, read off the project's .gitignore — check | --fix
src/cli/check-markdown.js     # Every project page's coordinates and readability floors — the Markdown (prose) gate
src/cli/check-names.js        # What the tree calls its own parts, and its empty directories — the Names (tree) gate, check | --fix
src/cli/check-publish.js      # The exports map against the tarball — the Publish gate (publint + attw)
src/cli/check-secrets.js      # No committed file carries a live credential — the Secrets gate (gitleaks, else patterns)
src/cli/check-suppressions.js # Every disable directive is spelled, reasoned and live — the Suppressions gate, check | --fix

src/cli/doctor.js             # Installed tool versions against the declared ranges — `typescript doctor`
src/cli/empty-directories.js  # The working copy's empty directories, read off the disk — the Names gate reports them, `fix` deletes them
src/cli/entry-points.js       # The entries a build compiles, read off the consumer's own exports map
src/cli/jterrazz-config.js    # A unit's jterrazz.config.ts, loaded — one package's section, or the problem that stops it
src/cli/lint-targets.js       # The project files oxlint and oxfmt are handed — the sweep every tree gate reads, never the directory
src/cli/merge-knip-config.js  # Merges knip base preset with project-local knip.json (read as JSONC)
src/cli/oxlint-report.js      # The Oxlint pass's log, drawn from the one JSON run in the form oxlint picks — oxlint-report-*.js draw it
src/cli/project-files.js      # The one sweep every tree gate starts from — every file git does not ignore, or a walk where there is no git
src/cli/unsafe-fixers.js      # The rules `fix` must not let oxlint rewrite, as one wrapped config per config scope
src/cli/workspace-members.js  # Lists the consumer's workspace members — the unit each per-package gate measures from

lint/                         # The lint manifest — every rule of every loaded plugin decided by name
├── _contract.js              # fragment() / on() / off() / unsafeFix() — refuses an unreasoned decision, at load time
├── compile.js                # fragment -> the plain oxlint config object; `merge()` is the exported compose()
├── profiles.js               # Which fragments each of the six profiles carries, and its ignore patterns
├── catalog.js                # The catalogue, rendered into the chapter's table and its fixer list
├── language/ · react.js · next.js · astro.js · a11y.js · bundler.js · vitest.js · sorted.js · react-native.js
└── architecture/             # hexagonal.js (the map this package ships) and layers.js (the builder)

src/presets/
├── tsconfig/ · tsdown/ · oxlint/profiles/ (the six, compiled) · oxfmt/ · knip/ · prettier/ (.astro only)
src/index.js + index.d.ts     # Package entry — exports { oxfmt, oxlint } profiles (JS-shipped, no build)
src/oxlint.js · oxfmt.js      # The tool-facing entries — the profiles, compose(), layers(), each tool's defineConfig
src/docs.js + docs.d.ts       # The manual's rules, pure — auditDocs(tree), exported at ./docs for a second reader
src/config.js + config.d.ts   # defineConfig() and JterrazzConfig — the family's settings file, exported at ./config
docs/                         # The corpus: numbered chapters and decisions/
skills/                       # The Claude Code skill — one hand-written SKILL.md
specs/                        # Product specifications (@jterrazz/test) — the shape is docs/03-testing.md
```

## Commands

| Task                                    | Command                   |
| --------------------------------------- | ------------------------- |
| Install from the lockfile               | `make install`            |
| Build (nothing to build — JS ships)     | `make build`              |
| Lint + format + typecheck + knip + docs | `make lint`               |
| Auto-fix lint issues                    | `make fix`                |
| Run all tests                           | `make test`               |
| The gate before a commit: lint, test    | `make check`              |
| Regenerate every golden and projection  | `TEST_UPDATE=1 make test` |

## Standing rule

A change to the public API updates `README.md`, the `docs/` chapters, and `skills/jterrazz-typescript/SKILL.md`. A change to a LINT DECISION is a line of a fragment under `lint/` and nothing else — the chapter's catalogue is its projection, regenerated with `TEST_UPDATE=1 npm test`. The repo-structure doctrine itself now lives in `jterrazz-studio` — never author it here or in a skill; route to it from `docs/08-repo-structure.md`.
