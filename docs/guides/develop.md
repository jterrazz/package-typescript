# Develop

How a change to the toolchain itself is made: the loop, where each kind of change lands, and what it owes. Wiring a project onto the toolchain is [Getting started](../start/getting-started.md).

## The loop

The package builds itself with the build plan it ships, so a build comes before every other gesture, and the specs drive the built command.

| Gesture         | Runs                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `make install`  | `npm ci`, once per change of the lockfile                                                                                                    |
| `make build`    | `npm run build`: the build plan the manifest derives, into `dist/` ([Architecture](../concepts/architecture.md#building-this-package))       |
| `make lint`     | this package's own `typescript check`, run on this package from `dist/`                                                                      |
| `make fix`      | `typescript fix`, `@jterrazz/test`'s fixers first inside it                                                                                  |
| `make test`     | the three vitest projects ([Test](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md))                             |
| `make mutation` | `typescript mutation`: the module tests over the sources they test, the whole suite over what they let live and the lines they leave (below) |
| `make check`    | `make lint`, `make test`, then `make mutation`: the gate before a commit                                                                     |

`make lint` and `make test` first lay the repository's own install of itself again from this build's tarball (`install-self`), so neither judges an install older than the checkout.

`make check-links` is opt-in and never part of `check`: it runs [lychee](https://lychee.cli.rs) over `README.md`, `docs/` and `skills/`, remote links included. It needs the network and a lychee on the machine, and says so where there is none. Why the gate leaves remote links out is [Quality checks](../reference/quality-checks.md#what-rumdl-judges)'s.

`make mutation` runs `typescript mutation`, which is [Stryker](https://stryker-mutator.io) twice ([Quality checks](../reference/quality-checks.md#mutation)). First the module tests of the `unit` project run over the sources of `src/` and `lint/` that carry one. Then the whole suite, specs and the processes they spawn included, runs over every mutant the module tests let live and over the changed lines of the working tree that no module test runs (the change not yet committed or, on a clean tree, the branch since its merge-base with the default branch). It mutates a sandbox copy under `.artifacts/stryker/tmp/`, never the checkout, leaves its reports in `.artifacts/stryker/`, and fails on any mutant a test runs and none detects ([its verdict](../reference/quality-checks.md#every-mutant-a-test-runs-is-detected)). `lint/self/` is outside its scope: its audits run over this repository's own corpus, which they hold clean, so a mutant that loosens an audit survives by construction, and proving an audit against a broken corpus would test a test, not anything a consumer relies on. Both runs are incremental: a run measures again only the mutants whose source changed, or that a test covers whose file, ground or reached sources changed since the report it left ([What a report keeps](../reference/quality-checks.md#what-a-report-keeps)). The module run inside `check` therefore takes seconds, and a first one in a fresh clone under ten minutes. The suite runs only when the module tests let a mutant live or the change reaches a line they leave, and then costs its build and a single-worker run of every node project, [as ADR-020 measured it](../decisions/020-mutation-measures-the-whole-suite-over-a-change.md#consequences), before its mutants.

The loop is `make mutation` twice on the incremental report: the first run measures and writes the survivors of its scope, the second reruns only the mutants a fix changed. A wave reports green only from a committed tree: a dirty tree measures the uncommitted change alone, a clean one `merge-base..HEAD`, and a verdict whose scope is narrower than the branch says so in a `warning:` line. `--since <base>` is the faithful probe of a branch; `--mutate` measures lines no change brought. A file moved or renamed is read by its content, so a pure move costs nothing, and a migration budgets one mutation round per moved I/O module that is not a pure move.

## Where a change lands

The layers decide it ([Architecture](../concepts/architecture.md)):

| Change                           | Lands in                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a lint decision                  | one line of a fragment under `lint/consumer/rulebook/`; the catalogue in [Lint presets](../reference/lint-presets.md) is its projection                                                                                                                                                                                                         |
| a lint rule of this package's    | a file under `lint/consumer/rules/<family>/`, assembled by `plugin.ts`, with its row in the catalogue                                                                                                                                                                                                                                           |
| a new pass of `check`            | its declaration in `lint/consumer/checks/`, listed by `lint/index.checker.ts`; a key in `src/commands/check/passes/passes.ts` with the function under `src/commands/check/passes/` that decides whether it applies, and the tool it runs driven from its folder of `src/drivers/`; its `checker` row in `lint/consumer/catalogue/manifest.json` |
| code two declarations share      | `lint/kit/`                                                                                                                                                                                                                                                                                                                                     |
| a refusal a shipped module makes | a `runtime` row of the manifest, and, when thrown, a four-part `refusal()` reading a heading of this manual                                                                                                                                                                                                                                     |
| a law every repository keeps     | a line of the standard, `src/standard/standard.ts` (`kinds/<kind>.ts`, `platforms/<platform>.ts` or `dependencies/<package>.ts` when only a kind, a platform or the users of a package keep it), never of a repository's `jterrazz.config.ts`                                                                                                   |
| a new configuration              | a file under `src/presets/`, and an `imports` entry of the manifest when the command loads it by path                                                                                                                                                                                                                                           |
| a new importable entry           | a `.ts` named by [the entry grammar](../reference/quality-checks.md#the-entry-grammar), in `src/`, or at the root of `lint/` when it exports the kit as `./rules` does; an `exports` subpath, or an `imports` one when only the package reaches it; the specs that load every subpath                                                           |

How the manifest and its audiences work is [Test § Who a rule is for](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md#who-a-rule-is-for).

## What a change owes

A change to the public surface reaches three places: `README.md`, the page that owns the subject, and `skills/jterrazz-typescript/SKILL.md`, which routes into the page and never restates it. The Markdown (prose) pass fails a skill naming a page that does not exist, and the specs compile every TypeScript example of the README and the manual against the packed package.

A generated table is regenerated, never edited: `TEST_UPDATE=1 npm test` rewrites the catalogue of [Lint presets](../reference/lint-presets.md), the id tables of [Quality checks](../reference/quality-checks.md) and every golden ([Test](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md#regenerating-a-golden)).

## Conventions

- Relative imports carry their `.js` extension: `import { foo } from './bar.js'`.
- The API is the types: a public export's signature is its documentation, and no generated reference sits beside it.
- An error a project can cause is a four-part `refusal()`; one only the toolchain can cause is `invariant()` ([Architecture § The command](../concepts/architecture.md#the-command)).
- Comments default to none; a name carries the meaning, and a comment that stays states its kind ([Lint presets](../reference/lint-presets.md#a-comment-states-its-kind)).

## The specs' scratch space

A spec that asserts on some passes of `check` or `fix` runs those alone, through a selector this checkout holds and the package does not: a chain runs the command as `SELECTING_BIN` and names its passes through `onlyPasses()`, both in `specs/cli/__setup__/check-passes.ts`.

Every directory a `cli` spec creates sits under one temp root per run: `specs/cli/__setup__/run-temp-root.ts` creates it under `/tmp`, points `TMPDIR` at it before the first worker starts, and removes it when the run ends. It stays out of a per-user temp folder, whose size slows every tool that walks up from its working directory looking for a config. A chain takes its scratch directories from `specs/__setup__/temporary-directory.ts`: `temporaryDirectory()` removes one when the test finishes, and `newDirectory()` leaves one a whole file shares to that file's `afterAll`. The module tests of the `unit` project create theirs under the system's temp folder and remove them themselves.
