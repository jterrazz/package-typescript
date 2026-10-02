# @jterrazz/typescript — documentation

The manual of the toolchain that builds, checks, lints and formats a `@jterrazz` project from one devDependency. What it is and why it exists is the repository's README; this page says which chapter answers which question, and in what order to read them.

## Using the toolchain in a project

Read these in order the first time: wiring first, then what the gate judges, then the rest by topic.

| Chapter                                     | Answers                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [02 — Developing](02-developing.md)         | Wiring a project, steps 1 to 5: the profile, the three config files, the scripts, the `Makefile`    |
| [06 — Quality checks](06-quality-checks.md) | What `check` and `fix` run, what makes each pass fail, and the baseline that holds a project's debt |
| [07 — Lint presets](07-lint-presets.md)     | The six profiles and every rule decision they carry, `compose()`, and the knip configuration        |
| [05 — Building](05-building.md)             | `build`, `bundle`, `start` and `dev`: what each produces, and for which kind of project             |
| [09 — Rules kit](09-rules-kit.md)           | The presets `jterrazz.config.ts` lists, their merge order and opt-outs; writing a rule with the kit |
| [08 — Repo structure](08-repo-structure.md) | The TypeScript half of the shared repository doctrine                                               |

## Changing the toolchain itself

| Chapter                                 | Answers                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [01 — Architecture](01-architecture.md) | The two sides, `lint/` that judges and `src/` that runs, the build, the command, the published subpaths |
| [02 — Developing](02-developing.md)     | Its last section: the `make` targets of this repository, and where a new pass, rule or entry goes       |
| [03 — Testing](03-testing.md)           | The three test projects, the documents that drive the command, the packed tarball, the self rules       |
| [04 — Operating](04-operating.md)       | What publishes the package, which version number moves, how a consumer takes a bump                     |

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
