# Developing

How a change to the toolchain itself is made: the loop, where each kind of change lands, and what it owes. Wiring a project onto the toolchain is [Getting started](05-getting-started.md).

## The loop

The package builds itself with the build plan it ships, so a build comes before every other gesture, and the specs drive the built command.

| Gesture        | Runs                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `make install` | `npm ci`, once per change of the lockfile                                                                                     |
| `make build`   | `npm run build`: the build plan the manifest derives, into `dist/` ([Architecture](01-architecture.md#building-this-package)) |
| `make lint`    | this package's own `typescript check`, run on this package from `dist/`                                                       |
| `make fix`     | `typescript fix`, `@jterrazz/test`'s fixers first inside it                                                                   |
| `make test`    | the three vitest projects ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md))            |
| `make check`   | `make lint`, then `make test`: the gate before a commit                                                                       |

`make lint` and `make test` first lay the repository's own install of itself again from this build's tarball (`install-self`), so neither judges an install older than the checkout.

Two gestures are opt-in and never part of `check`:

- `make check-links` runs [lychee](https://lychee.cli.rs) over `README.md`, `docs/` and `skills/`, remote links included. It needs the network and a lychee on the machine, and says so where there is none. Why the gate leaves remote links out is [Quality checks](07-quality-checks.md#what-rumdl-judges)'s.
- `make mutation` runs `typescript mutation` — [Stryker](https://stryker-mutator.io) over `src/` and `lint/` against the module tests of the `unit` project ([Quality checks](07-quality-checks.md#mutation)). It rewrites the sources in place for the whole run, so nothing else runs beside it, and leaves its report in `.artifacts/stryker/`. The specs spawn the built command, which no mutant of that run reaches, so its score measures the module tests alone; what the specs leave alive is [Testing § The mutants no test kills](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#the-mutants-no-test-kills).

## Where a change lands

The layers decide it ([Architecture](01-architecture.md)):

| Change                           | Lands in                                                                                                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a lint decision                  | one line of a fragment under `lint/consumer/rulebook/`; the catalogue in [Lint presets](08-lint-presets.md) is its projection                                                                                                                                               |
| a lint rule of this package's    | a file under `lint/consumer/rules/<family>/`, assembled by `plugin.ts`, with its row in the catalogue                                                                                                                                                                       |
| a new pass of `check`            | its declaration in `lint/consumer/checks/`, listed by `lint/index.checker.ts`; a key in `src/command/check/passes.ts` with the function under `src/command/check/` that decides whether it applies; its `checker` row in `lint/consumer/catalogue/manifest.json`            |
| code two declarations share      | `lint/kit/`                                                                                                                                                                                                                                                                 |
| a refusal a shipped module makes | a `runtime` row of the manifest, and, when thrown, a four-part `refusal()` reading a heading of this manual                                                                                                                                                                 |
| a law every repository keeps     | a line of the base preset, `lint/consumer/catalogue/preset.ts`, never of a repository's `jterrazz.config.ts`                                                                                                                                                                |
| a new configuration              | a file under `src/presets/`, and an `imports` entry of the manifest when the command loads it by path                                                                                                                                                                       |
| a new importable entry           | a `.ts` named by [the entry grammar](07-quality-checks.md#the-entry-grammar), in `src/`, or at the root of `lint/` when it exports the kit as `./rules` does; an `exports` subpath, or an `imports` one when only the package reaches it; the specs that load every subpath |

How the manifest and its audiences work is [Testing § Who a rule is for](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for).

## What a change owes

A change to the public surface reaches three places: `README.md`, the chapter that owns the subject, and `skills/jterrazz-typescript/SKILL.md`, which routes into the chapter and never restates it. The Markdown (prose) pass fails a skill naming a chapter that does not exist, and the specs compile every TypeScript example of the README and the manual against the packed package.

A generated table is regenerated, never edited: `TEST_UPDATE=1 npm test` rewrites the catalogue of [Lint presets](08-lint-presets.md), the id tables of [Quality checks](07-quality-checks.md) and every golden ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#regenerating-a-golden)).

## Conventions

- Relative imports carry their `.js` extension: `import { foo } from './bar.js'`.
- The API is the types: a public export's signature is its documentation, and no generated reference sits beside it.
- An error a project can cause is a four-part `refusal()`; one only the toolchain can cause is `invariant()` ([Architecture § The command](01-architecture.md#the-command)).
- Comments default to none; a name carries the meaning ([Lint presets](08-lint-presets.md#a-comment-no-longer-than-its-function)).

## The specs' scratch space

A spec that asserts on some passes of `check` or `fix` runs those alone, through a selector this checkout holds and the package does not: a chain runs the command as `SELECTING_BIN` and names its passes through `onlyPasses()`, both in `specs/cli/_setup/check-passes.ts`.

Every directory a `cli` spec creates sits under one temp root per run: `specs/cli/_setup/run-temp-root.ts` creates it under `/tmp`, points `TMPDIR` at it before the first worker starts, and removes it when the run ends. It stays out of a per-user temp folder, whose size slows every tool that walks up from its working directory looking for a config. A chain takes its scratch directories from `specs/cli/_setup/temporary-directory.ts`: `temporaryDirectory()` removes one when the test finishes, and `newDirectory()` leaves one a whole file shares to that file's `afterAll`. The module tests of the `unit` project create theirs under the system's temp folder and remove them themselves.
