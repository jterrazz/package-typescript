# @jterrazz/typescript — documentation

The complete TypeScript toolchain for the `@jterrazz` ecosystem: one devDependency that builds, checks, lints, formats and documents a project. A consumer wires three config files at the shipped presets and calls `typescript check` / `typescript fix`; there is nothing else to configure.

This corpus is where that knowledge is authored. `AGENTS.md` and the `jterrazz-typescript` skill route into it; they never restate it.

## Table of contents

The first four chapters are the spine every repository carries; the rest are this package's own subjects, numbered after it.

| Chapter                                     | Covers                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [01 — Architecture](01-architecture.md)     | The four layers, why the CLI is bash, the importable surface, the two TypeScript compilers |
| [02 — Developing](02-developing.md)         | Wiring a project onto the presets, the `.artifacts/` convention, working on this package   |
| [03 — Testing](03-testing.md)               | The two suites, the literate documents, when a `.test.ts` is the right answer              |
| [04 — Operating](04-operating.md)           | What publishes this package, which number moves, how a consumer takes a bump               |
| [05 — Building](05-building.md)             | `build`, `bundle`, `start`, `dev` — what each produces and for which project shape         |
| [06 — Quality checks](06-quality-checks.md) | `check` and `fix`: the passes they run, in parallel, and what makes each one fail          |
| [07 — Lint presets](07-lint-presets.md)     | The oxlint presets, `compose`, the architecture rules, and the knip configuration          |
| [08 — Docs pipeline](08-docs-pipeline.md)   | The `typescript docs` compiler and the committed `docs/reference/` projection              |
| [09 — Repo structure](09-repo-structure.md) | The TypeScript-specific half of the shared repo doctrine; the rest lives in the skill      |

`docs/reference/` is a generated projection, not a chapter — regenerate it with `typescript docs`, never hand-edit it.

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
