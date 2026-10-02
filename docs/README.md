# @jterrazz/typescript — documentation

The manual of the toolchain that builds, checks, lints and formats a project from one devDependency. What it is and why it exists is the repository's README; this page says which chapter answers which question, and in what order to read them.

## Start here

Read these two in order: they take a project from an empty folder to a green `typescript check`, and say everything it can configure.

| Chapter                                       | Answers                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [05 — Getting started](05-getting-started.md) | The first working project: the profile, the three config files, the scripts, the `Makefile`, the first run     |
| [06 — Configuration](06-configuration.md)     | `jterrazz.config.ts`, the presets a project lists and their merge order, the tsconfig presets, the lint config |

## Reference

Open these by topic, usually from the `read:` of a finding.

| Chapter                                     | Answers                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [07 — Quality checks](07-quality-checks.md) | Every pass of `check` and `fix`, what makes each fail, the ratchet that holds a project's debt, the drift report |
| [08 — Lint presets](08-lint-presets.md)     | The rulebook: its laws, the six profiles, the decisions worth explaining, knip, the full catalogue               |
| [09 — Building](09-building.md)             | `build`, `bundle`, `start`, `dev` and `tsc`: what each produces, and from which entries                          |
| [04 — Operating](04-operating.md)           | How a release is cut, which version number moves, and how a project adopts a stricter release                    |

## Writing rules for the family

| Chapter                           | Answers                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [10 — Rules kit](10-rules-kit.md) | The engine a sibling package writes its rules with: the row, the lesson, the check, the chapter, the debt |

## Changing the toolchain itself

| Chapter                                 | Answers                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [01 — Architecture](01-architecture.md) | The two sides, `lint/` that judges and `src/` that runs, the command, the published subpaths      |
| [02 — Developing](02-developing.md)     | The loop, where each kind of change lands, and what a change owes                                 |
| [03 — Testing](03-testing.md)           | The three test projects, the documents that drive the command, the packed tarball, the self rules |

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
