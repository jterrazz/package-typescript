---
name: jterrazz-repo-structure
description: Use when organizing or restructuring a repository's documentation, skills, AGENTS.md/CLAUDE.md, README, or generated docs — where knowledge lives, what gets committed, corpus vs injection layers vs compiler, projections vs presentations.
---

# Repo structure

The doctrine every `@jterrazz` repo follows for where knowledge lives. Canonical home: `docs/06-repo-structure.md`.

## Mental model

A repo is three distinct roles — conflating them is the failure mode this skill guards against:

1. **The corpus** — `docs/` (numbered chapters) + `README.md`. Where knowledge is _authored_.
2. **The injection layers** — `AGENTS.md`/`CLAUDE.md` (agent brief), `skills/` entries. They **route**, they never author.
3. **The compiler** — `typescript docs`. Projects the source barrel into `docs/reference/`.

Scope: the compiler half applies to **packages** (a public API surface to project). An **application** adopts roles 1–2 in full and never generates `docs/reference/` — the Docs sync pass self-gates on the directory's existence. Non-TypeScript repos: same rule (doctrine yes, compiler no, or the language's own generator).

Three golden rules, compressed:

- **Written once** — a piece of knowledge lives in one chapter; everything else links to it. No duplication between README, a skill, and a chapter.
- **Route, don't retell** — AGENTS.md/CLAUDE.md and skills are maps: a mental model + a routing table into `docs/`. When they start explaining, knowledge has leaked out of the corpus.
- **The compiler projects, never authors** — generated files are projections, stamped `DO-NOT-EDIT`. Change the corpus and regenerate; never hand-edit a projection.

Projection vs presentation — the line is which layers a derived file spans. A **projection crosses a layer** (source code → docs): the reference tree is **committed** and sync-checked (`typescript docs --check`), diffable and agent-readable from the tree. A **presentation re-packages within the docs layer** (an `llms.txt` concatenation, a rendered HTML site): it authors nothing new, is never committed, and is built in CI only if a delivery target exists — with none, no presentation is produced and the corpus is read directly. This repo has no presentation build.

## Canonical root-file layout

| File           | Role                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `README.md`    | The vitrine — what the package is, install, a pointer into `docs/`. Not a manual.     |
| `AGENTS.md`    | The agent brief — mental model + routing table into `docs/`. Routes, does not retell. |
| `CHANGELOG.md` | The release history.                                                                  |
| `TODO.md`      | The working backlog, when one is kept.                                                |
| `docs/`        | The corpus: numbered chapters, plus the generated `reference/` tree.                  |
| `skills/`      | Injection layer for agents — one skill per capability, routes into `docs/`.           |

## Where to look

| Task                                                                              | Chapter                     |
| --------------------------------------------------------------------------------- | --------------------------- |
| The doctrine itself (three roles, golden rules, layout)                           | `docs/06-repo-structure.md` |
| Compiler mechanics — what `typescript docs` generates and how sync-checking works | `docs/05-docs-pipeline.md`  |

Building, linting, or checking the TypeScript toolchain itself is a separate capability: see the `jterrazz-typescript` skill.

## Always

- Never restate a chapter's content in a skill or in AGENTS.md/CLAUDE.md — link to it instead.
- Never hand-edit `docs/reference/` — regenerate with `typescript docs`.
- Regenerate the reference projection in the same change that touches the source, so `docs --check` stays green.
- One skill per capability, split by genuinely distinct trigger conditions — not one skill restating two chapters.
