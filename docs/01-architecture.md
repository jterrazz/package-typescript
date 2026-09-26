# Architecture

One devDependency holds a project's whole toolchain, and this chapter says what is inside it.

The package is two sides that never mix: `lint/` JUDGES — every rule, every pass, every verdict a project can receive — and `bin/` with `src/` RUN — the shell CLI that orchestrates processes, the config presets a consumer's own files extend, and the importable surface for what code has to reach directly. `src/` imports from `lint/`; nothing of `lint/` imports from `src/`.

| Layer          | Holds                                                                                | Reached by                                        |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `bin/`         | `typescript.sh` and its commands — the orchestration, in bash                        | the `typescript` binary                           |
| `lint/`        | every judgement: the rulebook, the catalogue, our own rules, the passes, the ratchet | `bin/`, `src/`, and a consumer through `./oxlint` |
| `src/cli/`     | the engine's node scripts — the doctor, the lint targets, the report, the knip merge | `bin/`, and nothing else                          |
| `src/presets/` | tsconfig, tsdown, oxlint, oxfmt and knip configurations                              | a consumer's config files, by `extends`           |
| `src/`         | the importable entries — the barrel, `./config`, `./oxfmt`                           | a consumer's `import`                             |

The code the package ships sits under `src/` and `lint/`, both spine folders ([Repo structure](08-repo-structure.md)). `bin/` is the one root beside them, and it is npm's: a package's `bin` entry is where a registry install links the command from.

## The judging layer

`lint/` has one tree in every repository of the estate: `index.js` is the only file at its root, and each folder below is one of eight.

| Folder of `lint/` | Holds                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.js`        | the `./oxlint` entry: the six profiles compiled, `compose()`, `layers()`, `hexagonal`, `nested()`, oxlint's `defineConfig`                                                                                                                      |
| `rulebook/`       | one fragment per plugin, `frameworks/` for what a framework profile adds, `architecture/` for the layer maps; `decision.js` holds the builders and the closed vocabularies, `compile.js` the compiler, `profiles.js` the table of the six       |
| `catalogue/`      | `decisions.js`, every decision as one list and the unsafe fixers `fix` refuses; `checks.json`, the consumer rows of the manifest; `findings.json`, every id a pass or a rule prints, with its family and the one sentence it holds a project to |
| `rules/`          | the lint rules this package writes itself, one file per rule under the folder of its family, assembled by `plugin.js` into one oxlint JS plugin                                                                                                 |
| `checks/`         | one file per pass of `typescript check` that needs more than a process spawn — what one file cannot see: the tree, the manual, the directives, the prose                                                                                        |
| `ratchet/`        | the `typescript` section of `jterrazz.baseline.json`: read, judged exactly, lowered by `fix`                                                                                                                                                    |
| `reading/`        | how a pass reads a project: the sweep, the comment reader, the workspace members, the settings file, the entries, the installed tool versions                                                                                                   |
| `self/`           | what only this repository is held to and never ships: `catalogue.json`, the self rows of the manifest                                                                                                                                           |
| `migration/`      | the one-shot mover `fix` runs: every id this release renamed, rewritten where a project cites it — deleted by the major that follows                                                                                                            |

The rulebook is a manifest, not a config: one fragment per plugin, stating a decision per rule, and this package's own suite refusing a fragment that breaks either invariant — a level is `error` or `off`, and an `off` carries one of five recorded reasons ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for)).

Three steps and nothing between them. `lint/rulebook/profiles.js` says which fragments each profile carries; `lint/rulebook/compile.js` turns a fragment into the plain oxlint config object oxlint itself reads, and merges those objects; `lint/index.js` compiles the table, and `src/presets/oxlint/profiles/<name>.js` hands one profile to a consumer's `extends`. The rule decisions are [Lint presets](07-lint-presets.md)'s, catalogued there from the same manifest.

## No build step

This package ships JavaScript directly: what is committed is what is published (`files` names `bin`, `docs`, `lint`, `src`), save the tests beside the modules and [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md), the chapter of how this package proves itself, which are its own and ship nowhere. `npm run build` is a comment, and every `.d.ts` is hand-written beside its `.js`.

That is a deliberate exception to what the toolchain asks of everyone else, and it buys two things. A toolchain that had to build itself would need a second toolchain to do it; and a consumer reading `lint/checks/gitignore.js` in its own `node_modules` reads the source, not a bundle.

## Why the CLI is bash

`typescript check` runs up to fifteen passes, most of them separate processes — tsc, oxlint, oxfmt, knip, publint, dependency-cruiser and node scripts of this package's own. Bash starts them all with `&`, `wait`s on each pid, and reports each in one fixed order ([Quality checks](06-quality-checks.md)). A node orchestrator would add a process, a startup, and a dependency to reach the same fan-out.

The rule the split follows: **bash decides whether a gate applies; node decides what the gate says.** Whether a `.gitignore` exists, whether a repository is a repository, which workspace members own a `specs/` — those are one-line tests in `check.sh`. What is wrong with a `.gitignore`, or with a `docs/` tree, is a node script's, because the answer needs parsing and a rule roster.

## The importable surface

The barrel and five subpaths, all declared in the exports map — each a `.js` beside its hand-written `.d.ts`, but for the one JSON list, whose type the file itself is:

| Subpath                                    | Exports                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `@jterrazz/typescript`                     | the barrel — `{ oxfmt, oxlint }` presets                                                 |
| `@jterrazz/typescript/oxlint`              | the six profiles, `compose()`, `layers()`, `hexagonal` + `HEXAGONAL_MAP`, `defineConfig` |
| `@jterrazz/typescript/oxfmt`               | `base`, and oxfmt's own `defineConfig`                                                   |
| `@jterrazz/typescript/docs`                | `auditDocs()` — the manual's rules, pure                                                 |
| `@jterrazz/typescript/config`              | `defineConfig()` and `JterrazzConfig` — the family's settings file, typed                |
| `@jterrazz/typescript/oxlint-config-names` | the names oxlint looks for a config under, in its order — a JSON array                   |

The oxlint entry carries the six profiles by name — `node`, `next`, `astro`, `expo`, `bun`, `react` — plus three things about composing them: `compose()` merges configs left to right, `layers()` compiles a declared layer map into `no-restricted-imports` overrides, and `hexagonal` is the map this package ships, with `HEXAGONAL_MAP` the declaration behind it. Each config TYPE — `OxlintConfig`, `OxfmtConfig` — is re-exported from the tool that owns it, never restated here: a hand copy drifts, and a drifted copy stops a consumer's own config from type-checking.

Each one re-exports the underlying tool's `defineConfig` on purpose: a consumer's config file names `@jterrazz/typescript` and nothing else, which is the one-devDependency contract holding under pnpm's strict `node_modules` ([Developing](02-developing.md)). `specs/surface/package/exports.test.ts` resolves every subpath by its public specifier, and `declarations.test.ts` holds each `.d.ts` to the value surface of the `.js` beside it — the package is its own consumer #1.

`./config` types the one settings file of the whole family, `jterrazz.config.ts` ([Developing](02-developing.md)). `JterrazzConfig` is an interface so that each sibling package adds its own section by merging into it — `@jterrazz/test` declares `test` — and this entry never names a section it does not read.

`./oxlint-config-names` is the one list of the names a project's own oxlint config may take. `check` and `fix` read it to decide whether a project has a config or is handed the default, the drift report reads it to say which, and it is exported so that `@jterrazz/test`'s checker reads the same list rather than a copy of it, and counts a config exactly where this toolchain does: one owner, and a sibling that imports rather than restates.

`./docs` is the odd one out: it is not a config, it is a gate's engine, exported because that gate has two readers. `typescript check` reads a project it is installed in; an estate sweep reads clones it has installed nothing into. One pure function over a plain tree, and the rule ids, sentences and rosters stay in one executable copy.

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler, pulled in through the per-platform `@typescript/typescript-*` optionalDependencies and resolved by path in `check.sh`.

The ordinary `typescript` dependency stays on ^6 because two consumers need the JavaScript compiler API that the Go package no longer ships: `dependency-cruiser` (a `typescript <7` peer) and `eslint-plugin-perfectionist`, which does a bare `require('typescript')`.

**Never add `typescript@7`, or an npm alias of it, to this tree.** Under pnpm's hoist fallback it can hijack perfectionist's lookup and fail intermittently with `isExternalModuleNameRelative is not a function`.

## The unit is the workspace package

Every per-package gate measures from the nearest `package.json`, never from the repository: a workspace root runs those gates once per member, and a single-package project is the one run it always was. `lint/reading/workspace-members.js` answers what the members are, and every caller asks it rather than guessing.

The one gate that measures from the repository instead is the manual's, because a manual answers for a whole tree ([Quality checks](06-quality-checks.md)).

## Related

- [Developing](02-developing.md) — wiring a project onto these layers.
- [Quality checks](06-quality-checks.md) — what the gates are, and what each refuses.
- [Repo structure](08-repo-structure.md) — the shared doctrine this layout answers to.
