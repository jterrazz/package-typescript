# Architecture

One devDependency holds a project's whole toolchain, and this chapter says what is inside it.

The package is five layers that never mix: a shell CLI that orchestrates processes, node gates that answer one question each, the rulebook every lint decision is taken in, config presets a consumer's own files extend, and an importable surface for what code has to reach directly.

| Layer      | Holds                                                                   | Reached by                              |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `bin/`     | `typescript.sh` and its commands — the orchestration, in bash           | the `typescript` binary                 |
| `lib/`     | one node script per gate that needs more than a process spawn           | `bin/`, and nothing else                |
| `rules/`   | the lint manifest — every rule decided by name, and the compiler for it | `presets/oxlint/`, and `src/oxlint.js`  |
| `presets/` | tsconfig, tsdown, oxlint, oxfmt and knip configurations                 | a consumer's config files, by `extends` |
| `src/`     | the importable entries — the lint presets, and the manual's rule engine | a consumer's `import`                   |

## The rulebook layer

`rules/` is a manifest, not a config: one fragment per plugin, stating a decision per rule, and `rules/_contract.js` refusing at load time a fragment that breaks either invariant — a level is `error` or `off`, and an `off` carries one of five recorded reasons.

Three steps and nothing between them. `rules/profiles.js` says which fragments each profile carries; `rules/compile.js` turns a fragment into the plain oxlint config object oxlint itself reads, and merges those objects; `presets/oxlint/profiles/<name>.js` is that table compiled, and it is what a consumer's `extends` names. The rule decisions are [Lint presets](07-lint-presets.md)'s, catalogued there from the same manifest.

## No build step

This package ships JavaScript directly: what is committed is what is published (`files` names `bin`, `lib`, `presets`, `rules`, `src`). `npm run build` is a comment, and the `src/*.d.ts` files are hand-written beside their `.js`.

That is a deliberate exception to what the toolchain asks of everyone else, and it buys two things. A toolchain that had to build itself would need a second toolchain to do it; and a consumer reading `lib/check-gitignore.js` in its own `node_modules` reads the source, not a bundle.

## Why the CLI is bash

`typescript check` runs up to fifteen passes, most of them separate processes — tsc, oxlint, oxfmt, knip, publint, dependency-cruiser and node scripts of this package's own. Bash starts them all with `&`, `wait`s on each pid, and reports each in one fixed order ([Quality checks](06-quality-checks.md)). A node orchestrator would add a process, a startup, and a dependency to reach the same fan-out.

The rule the split follows: **bash decides whether a gate applies; node decides what the gate says.** Whether a `.gitignore` exists, whether a repository is a repository, which workspace members own a `specs/` — those are one-line tests in `check.sh`. What is wrong with a `.gitignore`, or with a `docs/` tree, is a node script's, because the answer needs parsing and a rule roster.

## The importable surface

The barrel and three subpaths, each a `.js` beside its hand-written `.d.ts`, all declared in the exports map:

| Subpath                       | Exports                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `@jterrazz/typescript`        | the barrel — `{ oxfmt, oxlint }` presets                                                   |
| `@jterrazz/typescript/oxlint` | the seven profiles, `compose()`, `layers()`, `hexagonal` + `HEXAGONAL_MAP`, `defineConfig` |
| `@jterrazz/typescript/oxfmt`  | `base`, and oxfmt's own `defineConfig`                                                     |
| `@jterrazz/typescript/docs`   | `auditDocs()` — the manual's rules, pure                                                   |

The oxlint entry carries the seven profiles by name — `node`, `library`, `next`, `astro`, `expo`, `bun`, `react` — plus three things about composing them: `compose()` merges configs left to right, `layers()` compiles a declared layer map into `no-restricted-imports` overrides, and `hexagonal` is the map this package ships, with `HEXAGONAL_MAP` the declaration behind it. Each config TYPE — `OxlintConfig`, `OxfmtConfig` — is re-exported from the tool that owns it, never restated here: a hand copy drifts, and a drifted copy stops a consumer's own config from type-checking.

Each one re-exports the underlying tool's `defineConfig` on purpose: a consumer's config file names `@jterrazz/typescript` and nothing else, which is the one-devDependency contract holding under pnpm's strict `node_modules` ([Developing](02-developing.md)). `specs/cli/preset/exports.test.ts` resolves every subpath by its public specifier, and `declarations.test.ts` holds each `.d.ts` to the value surface of the `.js` beside it — the package is its own consumer #1.

`./docs` is the odd one out: it is not a config, it is a gate's engine, exported because that gate has two readers. `typescript check` reads a project it is installed in; an estate sweep reads clones it has installed nothing into. One pure function over a plain tree, and the rule ids, sentences and rosters stay in one executable copy.

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler, pulled in through the per-platform `@typescript/typescript-*` optionalDependencies and resolved by path in `check.sh`.

The ordinary `typescript` dependency stays on ^6 because two consumers need the JavaScript compiler API that the Go package no longer ships: typedoc (peer range 5–6) and `eslint-plugin-perfectionist`, which does a bare `require('typescript')`.

**Never add `typescript@7`, or an npm alias of it, to this tree.** Under pnpm's hoist fallback it can hijack perfectionist's lookup and fail intermittently with `isExternalModuleNameRelative is not a function`.

## The unit is the workspace package

Every per-package gate measures from the nearest `package.json`, never from the repository: a workspace root runs those gates once per member, and a single-package project is the one run it always was. `lib/workspace-members.js` answers what the members are, and every caller asks it rather than guessing.

The one gate that measures from the repository instead is the manual's, because a manual answers for a whole tree ([Quality checks](06-quality-checks.md)).

## Related

- [Developing](02-developing.md) — wiring a project onto these layers.
- [Quality checks](06-quality-checks.md) — what the gates are, and what each refuses.
- [Repo structure](09-repo-structure.md) — the shared doctrine this layout answers to.
