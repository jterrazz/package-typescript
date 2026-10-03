# @jterrazz/typescript — documentation

The manual of the toolchain that builds, checks, lints and formats a project from one devDependency. What it is and why it exists is the repository's README; this page says which chapter answers which question, and in what order to read them.

## Start here

Read these two in order: they take a project from an empty folder to a green `typescript check`, and say everything it can configure.

| Chapter                                       | Answers                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [05 — Getting started](05-getting-started.md) | The first working project: the declaration, the derived files, the scripts, the `Makefile`, the first run      |
| [06 — Configuration](06-configuration.md)     | `jterrazz.config.ts`, the presets a project lists and their merge order, the tsconfig presets, the lint config |

## Common tasks

| To…                                              | Read                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| leave a path out of the gates                    | [Quality checks § Leaving a path out](07-quality-checks.md#leaving-a-path-out)           |
| silence one line, with its reason                | [Quality checks § Suppressions](07-quality-checks.md#the-suppressions-directives-pass)   |
| turn a lint rule off for the project             | [Configuration § The lint rules](06-configuration.md#the-lint-rules)                     |
| keep a root folder off the root spine            | [Quality checks § A root beside the spine](07-quality-checks.md#a-root-beside-the-spine) |
| understand a finding                             | its `read:`, a heading of this manual                                                    |
| adopt it on a project that lands red, or upgrade | [Operating § Adopting a stricter release](04-operating.md#adopting-a-stricter-release)   |
| run it in CI, or read its result from a script   | [Quality checks § Flags and exit codes](07-quality-checks.md#flags-and-exit-codes)       |
| hold imports to a layer map                      | [Quality checks § Architecture](07-quality-checks.md#the-architecture-layer-map-pass)    |

## Reference

Open these by topic, usually from the `read:` of a finding.

| Chapter                                     | Answers                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [07 — Quality checks](07-quality-checks.md) | Every pass of `check` and `fix`, what makes each fail, the ratchet that holds a project's debt, the drift report   |
| [08 — Lint presets](08-lint-presets.md)     | The rulebook: its laws, the six profiles, the decisions worth explaining, knip, the full catalogue                 |
| [09 — Building](09-building.md)             | `build`, `start`, `dev` and `tsc`: what the build derives from the manifest, and what it produces                  |
| [04 — Operating](04-operating.md)           | Upgrading a project onto a stricter release (`doctor`, `baseline`); how this package cuts a release and numbers it |

## Writing rules for the family

| Chapter                           | Answers                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [10 — Rules kit](10-rules-kit.md) | The kit a sibling package writes its rules with: the row, the lesson, the check, the chapter, the debt |

## Changing the toolchain itself

| Chapter                                 | Answers                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [01 — Architecture](01-architecture.md) | The two sides, `lint/` that judges and `src/` that runs, the command, the published subpaths      |
| [02 — Developing](02-developing.md)     | The loop, where each kind of change lands, and what a change owes                                 |
| [03 — Testing](03-testing.md)           | The three test projects, the documents that drive the command, the packed tarball, the self rules |

The package ships this manual but not Testing, which describes the self rules no consumer receives. So the other chapters link Testing on GitHub, where a copy under `node_modules/` can still reach it.

## The words of this manual

### Running the gate

- **The command** — the `typescript` binary and what runs behind it. `typescript check` is the gate a project runs; `make check` is the gate a repository runs, the command among the rest.
- **Pass** — one question `check` asks, printed under its own `RUN` header: TypeScript Check, Oxlint, Names (tree) and the rest ([Quality checks § The passes](07-quality-checks.md#the-passes)). Every pass is a **gate**: it fails the run on any finding.
- **Finding** — one thing a pass refuses: a position, a rule id such as `names/no-grab-bag-name`, and a **lesson** in four parts, `found · why · fix · read`, whose `read` is a heading of this manual.
- **Ratchet** — a recorded debt that may only fall. `typescript baseline` writes the **baseline**, today's counts, into `.jterrazz/oxlint-suppressions.json` and `.jterrazz/baseline.json`; a count that grows fails the run, and one that falls is lowered by `fix` ([Quality checks § The ratchet](07-quality-checks.md#the-ratchet)).
- **Drift** — how far a project stands from its profile: rules set apart, suppressions, baseline counts, tool versions, laws set aside. It is reported at the end of every `check`, not judged ([Quality checks § The drift report](07-quality-checks.md#the-drift-report)).

### Declaration, profiles and presets

One word per meaning:

- **Declaration** — what a project says it is in `jterrazz.config.ts`: its **kind** (`library`, `api`, `cli`, `website`, `mobile`, `workspace`) and its **platform** (`node`, `bun`, `react`, `next`, `astro`, `expo`). Every law, check and derived file follows from it ([Getting started § Declare what the project is](05-getting-started.md#1-declare-what-the-project-is)).
- **Profile** — which framework's lint rules a project takes, one of six ([Lint presets § The profiles](08-lint-presets.md#the-profiles)). The platform picks it.
- **Preset** — what a package holds a project to, listed under `presets` in `jterrazz.config.ts`: lint rules, layers, name rules, checks, debt and settings ([Configuration § Presets](06-configuration.md#presets)).
- **Base preset** — the preset of this package, which the declaration derives: always on, never listed; it carries the family's laws ([Configuration § The base preset](06-configuration.md#the-base-preset)).
- **Package preset** — the preset a sibling package contributes beside it, such as `test()` from `@jterrazz/test`.
- **Derived file** — a file at the root an editor reads, whose whole content the declaration decides: `oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json` ([Quality checks § The Config pass](07-quality-checks.md#the-config-one-file-pass)).
- **Config preset** — a file a tool's own config extends rather than a preset: the tsconfig presets (`@jterrazz/typescript/tsconfig/node` and the others), and the knip preset the command derives knip's config from. [Lint presets](08-lint-presets.md) is the rulebook the profiles carry.

### The two spines

- **The docs spine** — the chapters at fixed numbers every manual opens on ([Quality checks § The Docs pass](07-quality-checks.md#the-docs-layout-pass)).
- **The root spine** — the folders a repository root may hold without declaring them ([Quality checks § The root spine](07-quality-checks.md#the-root-spine)).

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
