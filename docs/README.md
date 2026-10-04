# @jterrazz/typescript — the manual

The toolchain that builds, checks, lints and formats a project from one devDependency. What it is and why it exists is the repository's README; this page lists every page of the manual, by what the reader came to do.

## Start

| Page                                        | Answers                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Getting started](start/getting-started.md) | From an empty folder to a green `typescript check`: the declaration, the derived files, the scripts, the `Makefile`, the first run |

## Guides

| Page                                                           | Answers                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Adopt a stricter release](guides/adopt-a-stricter-release.md) | Taking a bump that lands red to green: `doctor`, `baseline`, the provider pinned to its runner                      |
| [Develop](guides/develop.md)                                   | Changing the toolchain itself: the loop, where each kind of change lands, what a change owes                        |
| [Test](guides/test.md)                                         | Proving a change: the three test projects, the documents that drive the command, the packed tarball, the self rules |
| [Release](guides/release.md)                                   | How this package is published, and which number a change moves                                                      |

A smaller task is one section of a reference page:

| To…                                            | Read                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| leave a path out of the gates                  | [Quality checks § Leaving a path out](reference/quality-checks.md#leaving-a-path-out)           |
| silence one line, with its reason              | [Quality checks § Suppressions](reference/quality-checks.md#the-suppressions-directives-pass)   |
| turn a lint rule off for the project           | [Configuration § The lint rules](reference/configuration.md#the-lint-rules)                     |
| keep a root folder off the root spine          | [Quality checks § A root beside the spine](reference/quality-checks.md#a-root-beside-the-spine) |
| understand a finding                           | its `read:`, a heading of this manual                                                           |
| run it in CI, or read its result from a script | [Quality checks § Flags and exit codes](reference/quality-checks.md#flags-and-exit-codes)       |
| hold imports to a layer map                    | [Quality checks § Architecture](reference/quality-checks.md#the-architecture-layer-map-pass)    |

## Concepts

| Page                                     | Answers                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| [The ideas](concepts/ideas.md)           | The declaration, the one settings file, the two commands, the ratchet — and why each is so   |
| [Architecture](concepts/architecture.md) | The two sides, `lint/` that judges and `src/` that runs, the command, the published subpaths |

## Reference

Open these by topic, usually from the `read:` of a finding.

| Page                                          | Answers                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Commands](reference/commands.md)             | Every command of the binary, and the page that owns each                                                         |
| [Configuration](reference/configuration.md)   | `jterrazz.config.ts`, the presets a project lists and their merge order, the tsconfig presets, the lint config   |
| [Quality checks](reference/quality-checks.md) | Every pass of `check` and `fix`, what makes each fail, the ratchet that holds a project's debt, the drift report |
| [Lint presets](reference/lint-presets.md)     | The rulebook: its laws, the six profiles, the decisions worth explaining, knip, the full catalogue               |
| [Building](reference/building.md)             | `build`, `start`, `dev` and `tsc`: what the build derives from the manifest, and what it produces                |
| [Rules kit](reference/rules-kit.md)           | The kit a sibling package writes its rules with: the row, the lesson, the check, the page, the debt              |
| [Glossary](reference/glossary.md)             | The words of this manual, one meaning each                                                                       |

The package ships this manual but not [Test](guides/test.md), which describes the self rules no consumer receives. So the other pages link it on GitHub, where a copy under `node_modules/` can still reach it.

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
