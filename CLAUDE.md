# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds, quality checks, and API docs. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`, mapped by `docs/README.md`. Decisions this package alone took are in `docs/decisions/`. Do not duplicate it — link to it.

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
├── typescript.sh          # CLI entry (build, bundle, start, dev, docs [--check], check, fix, clean)
└── commands/
    ├── check.sh           # Quality passes in parallel: tsc + oxlint + oxfmt + (gitignore) + knip + (conventions) + (docs sync)
    └── docs.sh            # The docs compiler: typedoc reference tree, generate | --check
lib/check-gitignore.js     # The artefact convention, read off the project's .gitignore — check | --fix
lib/merge-knip-config.js   # Merges knip base preset with project-local knip.json
lib/workspace-members.js   # Lists the consumer's workspace members — the unit each per-package gate measures from
presets/
├── tsconfig/ · tsdown/ · oxlint/ (+ architectures/hexagonal) · oxfmt/ · knip/
src/index.js + index.d.ts  # Package entry — exports { oxfmt, oxlint } presets (JS-shipped, no build)
docs/                      # The corpus: numbered chapters + the generated reference/ projection
specs/                     # Product specifications (@jterrazz/test) — see below
```

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler, pulled in via the per-platform `@typescript/typescript-*` optionalDependencies (resolved by path in `check.sh`). The regular `typescript` dependency stays on ^6 because typedoc (peer range 5–6) and eslint-plugin-perfectionist (bare `require('typescript')`) need the JS compiler API, which the Go package no longer ships. Never add `typescript@7` (or an npm alias of it) to the tree: under pnpm's hoist fallback it can hijack perfectionist's typescript lookup (`isExternalModuleNameRelative is not a function`), intermittently.

## Docs compiler internals

- `docs.sh` resolves the entry barrel as `src/index.ts`, else `src/index.d.ts` (this package is the JS-shipped case — its `tsconfig.json` includes `src/index.d.ts` so typedoc can read it). It compiles ONE project root, handed to it as an argument; which roots those are is `typescript.sh`'s question — the project itself, or each workspace member that owns a barrel and a `docs/`.
- Output goes to a **committed** path under `docs/` (the reference tree), each file stamped with a `DO-NOT-EDIT` first line. Generation is deterministic (`LC_ALL=C`, `find | sort`, no timestamps) — two runs are byte-identical. Only `docs/reference/` is projected: it is the one cross-layer compile (source → docs); the chapters are authored corpus, not re-packaged into an `llms.txt` (that would be a same-layer presentation, and there is no delivery target for one here).
- `docs.sh --check` regenerates into a temp dir and diffs the committed reference tree without touching it; `check.sh` runs it as the **Docs (sync)** pass once `docs/reference/` exists.

## Self-lint ordering

`oxlint.config.ts` loads the `@jterrazz/test` ESM plugin via the exports map, and `check` type-checks `specs/` + `src/index.d.ts`. `npm run lint` is `typescript check` on this repo — it now includes the Docs (sync) pass on this repo's own committed `docs/`, the ultimate dogfood. Keep the committed docs in sync (regenerate on any corpus change) or lint fails.

## Specs (self-test)

`specs/cli/` drives the real product command through `specification.cli(bin/typescript.sh)` (CONVENTIONS B9 — never a tool underneath it). Layout C1': runners (`*.specification.ts`) at the facet root, scenarios in domain folders (`specs/cli/<domain>/`). What a spec stands on carries a leading underscore (`@jterrazz/test` 14): the shared fixture projects are the pool `specs/_fixtures/` (reached via `fixture: $FIXTURES/…`) and hold only what SEVERAL domains use — `sample-app`, `sample-documented`, `incremental-app` (check and clean). A fixture one domain alone reaches for lives beside it, in `specs/cli/<domain>/_fixtures/`, named by the relative form; goldens are `_expected/`.

**A scenario is a document.** Most of them are `<case>.spec.yaml` files beside the spec — `description:` the vitest title, `fixture:` the ground, `runs:` the session with each command's `exit:`, `stdout:`, `stderr:` and the `files:` it left behind. `vitest.config.ts` wires them with `literate({ specification })` from `@jterrazz/test/vitest`, which binds every document of this repo to `cli.specification.ts` — the product runner. Regenerate the streams with `TEST_UPDATE=1`; tokens survive it. The format is `@jterrazz/test`'s `docs/04-cli.md`.

- **A `.test.ts` is the exception, and it says which one it is.** Four drive a binary that is not the product (the B9w exceptions: `oxfmt`, `oxlint` twice, the split-install sandbox), one waits on a marker in a stream with no byte-exact form (`dev/`), one needs a GROUND no fixture can be — a real git repository, for the artefact gate's committed-artefact claim — one needs a cwd no fixture can be ABOVE — a member run from inside a workspace, testing the gitignore gate's ancestor walk, since `fixture:` spreads a project INTO the working directory and the literate `run` schema has no per-run `cwd` to place an ancestor `.gitignore` outside it — and two are BRIDGES — `cli.run('<case>.spec.yaml')` runs the document, then code adds the one claim the format cannot make (a byte-exact directory golden, an exhaustive file list). A bridged document is excluded from the plugin's glob in `vitest.config.ts` so it runs once.
- `specs/cli/docs/` — the docs compiler: six documents plus the two bridges in `generation.test.ts` and `workspace.test.ts`. Drift fixtures overlay `sample-documented` to tamper one file.
- `specs/cli/check/` — twenty-four documents, each stating the whole combined `check`/`fix` output (D11). Where a fixture makes a tool refuse for a reason the scenario is not about — a knip case with no tsconfig, so tsc prints its manual — the document spans that block with `{{any}}` and a comment naming whose it is.
- The one `transform` (D6's escape hatch) is in `cli.specification.ts`: rolldown's slow-plugin advisory appears on stderr with the machine's load, never with the command, so no token can cover it.

## Commands

| Task                                         | Command                    |
| -------------------------------------------- | -------------------------- |
| Run all tests                                | `npm test`                 |
| Lint + format + typecheck + knip + docs sync | `npm run lint`             |
| Auto-fix lint issues                         | `npm run lint:fix`         |
| Regenerate docs projections                  | `./bin/typescript.sh docs` |

## Standing rule

A change to the corpus (README or a chapter) or the public API means **regenerate the projections in the same change** (`./bin/typescript.sh docs`) — the Docs (sync) pass will fail otherwise. A change to the public API also updates `README.md`, the `docs/` chapters, and `skills/jterrazz-typescript/`. The repo-structure doctrine itself now lives in `jterrazz-studio` — never author it here or in a skill; route to it from `docs/06-repo-structure.md`.
