---
name: jterrazz-typescript
description: Use when building, checking, linting, formatting, or configuring a TypeScript project with @jterrazz/typescript — build/bundle/dev/start, a failing `typescript check` pass, oxlint/oxfmt/knip/tsconfig presets, compose() lint config, the ratchet.
---

# @jterrazz/typescript

One devDependency that builds, checks, lints and formats a project. The manual is the package's `docs/`, read from the install — `node_modules/@jterrazz/typescript/docs/` — or from this repository when the toolchain itself is the change. This page decides what to run and which chapter to open; the chapter owns the rule.

## What to run

| Gesture                  | When                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `typescript fix`         | before every commit — lint fixes, formatting, `.gitignore`, spellings, empty directories |
| `typescript check`       | the gate — every pass in parallel, then the drift report                                 |
| `typescript build`       | an application: ESM + types into `dist/`                                                 |
| `typescript bundle`      | a library: ESM + CJS + types, entries read off the `exports` map                         |
| `typescript doctor`      | first read after a bump: installed tools against the declared ranges                     |
| `typescript baseline`    | a bump lands red: record today's counts, exact — `fix` re-records one that fell          |
| `typescript docs-layout` | a repository with no npm project: the manual's shape, alone                              |

A project names ONE profile — `node`, `next`, `astro`, `expo`, `bun`, `react` — in `oxlint.config.ts` and the matching preset in `tsconfig.json` (a published package: `node`, with the `library` tsconfig), and its three config files import `@jterrazz/typescript` and nothing else. The wiring is `docs/02-developing.md`.

## What a failing pass means

Every pass that ran prints a `RUN` header and one verdict; a pass that did not apply prints nothing. Each rule id below is explained in `docs/06-quality-checks.md`, under the pass's own section.

| Pass                      | It failed because                                                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript Check          | tsc 7 refused a type                                                                                                                                                                                                                                                                     |
| Oxlint Check              | a rule of the profile fired, a `baseline-ratchet` count moved, or `jterrazz.baseline.json` is unreadable or not the only ratchet file                                                                                                                                                    |
| Oxfmt Check               | a file is not formatted — `typescript fix`                                                                                                                                                                                                                                               |
| Gitignore (artefacts)     | an artefact is named or committed outside `.artifacts/<tool>/`                                                                                                                                                                                                                           |
| Knip (unused code)        | a file, export or dependency nothing uses                                                                                                                                                                                                                                                |
| Test Conventions          | `@jterrazz/test`'s checker refused a spec — its own manual owns the id                                                                                                                                                                                                                   |
| Docs (layout)             | the repository's `docs/` breaks the manual's spine, or holds a generated `reference/`                                                                                                                                                                                                    |
| Publish (packaging)       | the `exports` map promises a file the tarball does not carry, or a shipped file is compiled from test material                                                                                                                                                                           |
| Architecture (layer map)  | an import crosses the declared layer map                                                                                                                                                                                                                                                 |
| Astro (check + format)    | `astro check` or prettier refused a `.astro` file                                                                                                                                                                                                                                        |
| Suppressions (directives) | a disable directive is misspelled, unreasoned, or names a dead rule                                                                                                                                                                                                                      |
| Markdown (prose)          | a page cites a path that is gone, or a block runs past its floor                                                                                                                                                                                                                         |
| Names (tree)              | a name says nothing, names a construct (`types.ts`), is written in half, a skill holds more than its `SKILL.md`, a root sits outside the spine undeclared, `jterrazz.config.ts` does not load, the `Makefile` misses one of the six gestures, or a directory is empty — `typescript fix` |
| Secrets (credentials)     | a committed line looks like a live credential                                                                                                                                                                                                                                            |

The drift report closes the run; its one refusal is a profile rule turned off with no `// reason:` beside it.

## Before writing

- A file is named for its subject in the domain: never `types.ts`, `utils.ts`, `constants.ts`, nor a `*.types.ts` suffix. `index.ts` is a barrel and stays.
- A file holds 300 lines and a function 60; a `*.spec.ts` is `@jterrazz/test`'s C33, at 400 — `docs/07-lint-presets.md`.
- A suppression carries its reason: `// oxlint-disable-next-line <rule> -- why`, and `@ts-expect-error` with a description.
- Every artefact lives under `.artifacts/<tool>/`; `dist/` is the product, not an artefact.
- A `knip.json` ignore carries a `//` reason above it — the file is read as JSONC.
- The API is the types: there is no generated reference, and `docs/` never holds one.
- A repository root holds `src/`, `lint/`, `specs/`, `docs/`, `skills/` — any other root folder fails Names (tree) unless the ecosystem imposes it (`bin/`, `public/`, `app/`…) or `jterrazz.config.ts` declares it under `typescript.roots` with a reason.
- A repository's root `Makefile` answers `make install`, `build`, `lint`, `fix`, `test` and `check`; a workspace member owes none of them.
- A local `compilerOption` is a smell — the preset is where the fix belongs.

## The chapter to read next

| Question                                       | Chapter                     |
| ---------------------------------------------- | --------------------------- |
| the layers, the exports map, the two compilers | `docs/01-architecture.md`   |
| wiring a project, `.artifacts/`, a bump        | `docs/02-developing.md`     |
| how this toolchain proves itself               | `docs/03-testing.md`        |
| which number moves on a release                | `docs/04-operating.md`      |
| `build`, `bundle`, `start`, `dev`              | `docs/05-building.md`       |
| a failing pass, a rule id, the ratchet         | `docs/06-quality-checks.md` |
| a lint rule, a profile, `compose()`, knip      | `docs/07-lint-presets.md`   |
| what a repository root holds                   | `docs/08-repo-structure.md` |
