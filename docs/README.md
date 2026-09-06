# @jterrazz/typescript — documentation

The complete TypeScript toolchain for the `@jterrazz` ecosystem: one devDependency that builds, checks, lints, formats and documents a project. A consumer wires three config files at the shipped presets and calls `typescript check` / `typescript fix`; there is nothing else to configure.

This corpus is where that knowledge is authored. `CLAUDE.md` and the `jterrazz-typescript` skill route into it; they never restate it.

## Table of contents

| Chapter                                       | Covers                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [01 — Getting started](01-getting-started.md) | Install, the tsconfig/oxlint/oxfmt wiring, the npm scripts, the `.artifacts/` convention |
| [02 — Building](02-building.md)               | `build`, `bundle`, `start`, `dev` — what each produces and for which project shape       |
| [03 — Quality checks](03-quality-checks.md)   | `check` and `fix`: the passes they run, in parallel, and what makes each one fail        |
| [04 — Lint presets](04-lint-presets.md)       | The oxlint presets, `compose`, the architecture rules, and the knip configuration        |
| [05 — Docs pipeline](05-docs-pipeline.md)     | The `typescript docs` compiler and the committed `docs/reference/` projection            |
| [06 — Repo structure](06-repo-structure.md)   | The TypeScript-specific half of the shared repo doctrine; the rest lives in the skill    |

`docs/reference/` is a generated projection, not a chapter — regenerate it with `typescript docs`, never hand-edit it.

## Decisions

The records of decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken. A decision spanning several repositories is recorded by the corpus that spans them.
