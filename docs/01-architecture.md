# Architecture

One devDependency holds a project's whole toolchain, and this chapter says what is inside it.

The package is four layers that never mix: a shell CLI that orchestrates processes, node gates that answer one question each, config presets a consumer's own files extend, and an importable surface for what code has to reach directly.

| Layer      | Holds                                                                   | Reached by                              |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `bin/`     | `typescript.sh` and its commands — the orchestration, in bash           | the `typescript` binary                 |
| `lib/`     | one node script per gate that needs more than a process spawn           | `bin/`, and nothing else                |
| `presets/` | tsconfig, tsdown, oxlint, oxfmt and knip configurations                 | a consumer's config files, by `extends` |
| `src/`     | the importable entries — the lint presets, and the manual's rule engine | a consumer's `import`                   |

## No build step

This package ships JavaScript directly: what is committed is what is published (`files` names `bin`, `lib`, `presets`, `src`). `npm run build` is a comment, and the `src/*.d.ts` files are hand-written beside their `.js`.

That is a deliberate exception to what the toolchain asks of everyone else, and it buys two things. A toolchain that had to build itself would need a second toolchain to do it; and a consumer reading `lib/check-gitignore.js` in its own `node_modules` reads the source, not a bundle.

## Why the CLI is bash

`typescript check` runs up to eight gates, most of them separate processes — tsc, oxlint, oxfmt, knip, and node scripts of this package's own. Bash starts them all with `&`, `wait`s on each pid, and prints only the logs of the runs that failed ([Quality checks](06-quality-checks.md)). A node orchestrator would add a process, a startup, and a dependency to reach the same fan-out.

The rule the split follows: **bash decides whether a gate applies; node decides what the gate says.** Whether a `.gitignore` exists, whether a repository is a repository, which workspace members own a `specs/` — those are one-line tests in `check.sh`. What is wrong with a `.gitignore`, or with a `docs/` tree, is a node script's, because the answer needs parsing and a rule roster.

## The importable surface

The barrel and three subpaths, each a `.js` beside its hand-written `.d.ts`, all declared in the exports map:

| Subpath                       | Exports                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `@jterrazz/typescript`        | the barrel — `{ oxfmt, oxlint }` presets                    |
| `@jterrazz/typescript/oxlint` | the named presets, `compose()`, oxlint's own `defineConfig` |
| `@jterrazz/typescript/oxfmt`  | `base`, and oxfmt's own `defineConfig`                      |
| `@jterrazz/typescript/docs`   | `auditDocs()` — the manual's rules, pure                    |

Each one re-exports the underlying tool's `defineConfig` on purpose: a consumer's config file names `@jterrazz/typescript` and nothing else, which is the one-devDependency contract holding under pnpm's strict `node_modules` ([Developing](02-developing.md)). `specs/cli/preset/exports.test.ts` resolves every subpath by its public specifier — the package is its own consumer #1.

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
