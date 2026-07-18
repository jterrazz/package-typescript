# Repo structure

A repository is a written corpus, some thin injection layers, and a compiler that projects the corpus into machine-readable forms. Keep those three roles distinct and knowledge stays in exactly one place.

This is the doctrine every `@jterrazz` repo follows. It is the canonical home for it.

## The three roles

1. **The corpus** — `docs/` (numbered chapters) plus `README.md`. This is where knowledge is _authored_: prose a human writes and maintains.
2. **The injection layers** — `AGENTS.md` (agent brief), the `skills/` entries. They **route**, they never author. A skill points at chapter 03 for check failures; it does not restate what check does.
3. **The compiler** — the `typescript docs` command. It projects the source barrel into `docs/reference/`.

## Three golden rules

- **A piece of knowledge is written once.** It lives in one chapter. Everything else links to it. No paragraph is duplicated between the README, a skill, and a chapter.
- **AGENTS.md and skills route without retelling.** They are maps, not territory: a mental model plus a routing table into `docs/`. When they start explaining, the knowledge has leaked out of the corpus.
- **The compiler projects; it never authors.** Generated files are projections of the corpus, stamped `DO-NOT-EDIT`. You change the corpus and regenerate — you never edit a projection.

## Committed projections vs presentations

The dividing line is which layers a derived file spans:

- **A projection crosses a layer boundary** — it compiles one layer into another (source code → docs). It is **committed**, so it is diffable, greppable, and agent-readable straight from the tree, and kept honest by a sync check. The reference tree (`docs/reference/`, sync-checked by `typescript docs --check`) is the only projection here. See [Docs pipeline](05-docs-pipeline.md).
- **A presentation re-packages within one layer** — it re-arranges docs into another docs shape (an `llms.txt` concatenation, a rendered HTML site). It authors no new knowledge, so it is never committed; it is **built in CI only if a delivery target exists** (a hosted site, an agent-ingestion endpoint). With no such target, no presentation is produced at all — the committed corpus is read directly.

Concretely, this repo has **no** presentation build: the chapters and the reference tree are consumed straight from the tree.

## Root file conventions

| File           | Role                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `README.md`    | The vitrine — what the package is, install, a pointer into `docs/`. Not a manual.     |
| `AGENTS.md`    | The agent brief — mental model + routing table into `docs/`. Routes, does not retell. |
| `CHANGELOG.md` | The release history.                                                                  |
| `TODO.md`      | The working backlog, when one is kept.                                                |

The corpus (`docs/` + `README`) carries the knowledge; the root files and skills route to it; the compiler keeps the machine-readable projection in lockstep.

## Packages vs applications

The `docs/reference/` projection exists for **packages** — a published library has a public API surface that others consume, and the compiler keeps its readable form in lockstep with the code. An **application** (an API server, a product CLI, a web app) has no API consumers: it adopts the doctrine in full — the corpus, the routing layers, the single-home rule — and simply never generates `docs/reference/`. Nothing to configure: the Docs sync pass of `typescript check` activates only when a `docs/reference/` exists, so an application that never runs `typescript docs` never carries the pass.

## Non-TypeScript repos

The doctrine applies in full to every repo, whatever the language: a written corpus, thin routing layers, and knowledge that lives in exactly one place. What is TypeScript-specific is only the _compiler_ half — `typescript docs` and its `docs/reference/` projection exist because there is a TypeScript source barrel to compile. A Go, Rust, or infra repo keeps the same corpus and routers and the same single-home rule; it simply has no source-to-reference projection (or substitutes its own language's doc generator). The projection-vs-presentation criterion is unchanged: a cross-layer compile is committed, a same-layer re-packaging is a presentation built only when a delivery target exists.

## Related

- [Docs pipeline](05-docs-pipeline.md) — the compiler and its projections.
- [Getting started](01-getting-started.md) — setting a repo up.
