---
name: jterrazz-typescript
description: Use when building, checking, linting, formatting, or configuring a TypeScript project with @jterrazz/typescript — build/bundle/dev/start, a failing `typescript check` pass, oxlint/oxfmt/knip/tsconfig presets, compose() lint config, the presets of `jterrazz.config.ts`, the baseline (`jterrazz.baseline.json`), writing a rule with `@jterrazz/typescript/rules`.
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
| `typescript baseline`    | a bump lands red: record today's counts, exact — `fix` lowers one that fell              |
| `typescript docs-layout` | a repository with no npm project: the manual's shape, alone                              |

A project names ONE profile — `node`, `next`, `astro`, `expo`, `bun`, `react` — in `jterrazz.config.ts`, as `presets: [typescript({ profile })]`, and the matching preset in `tsconfig.json` (a published package: `node`, with the `library` tsconfig); its `oxlint.config.ts` is `defineConfig(fromPresets(settings))`, and its config files import the toolchain's packages and nothing else. The wiring is `docs/02-developing.md`.

## What a failing pass means

Every pass that ran prints a `RUN` header and one verdict; a pass that did not apply prints nothing. Each rule id below is explained in `docs/06-quality-checks.md`, under the pass's own section.

| Pass                      | It failed because                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript Check          | tsc 7 refused a type                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Oxlint Check              | a rule fired that `oxlint-suppressions.json` does not hold — fix it, or `typescript baseline`; a recorded count fell — `typescript fix`; an oxlint rule is left in `jterrazz.baseline.json` (`baseline-moved-to-oxlint`) — `typescript baseline`; a directive suppresses nothing (`Unused oxlint-disable directive`, `reportUnusedDisableDirectives`) — delete it; a `@ts-ignore` or an undescribed `@ts-expect-error` (`typescript/ban-ts-comment`)       |
| Oxfmt Check               | a file is not formatted — `typescript fix`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Gitignore (artefacts)     | an artefact is named or committed outside `.artifacts/<tool>/`                                                                                                                                                                                                                                                                                                                                                                                             |
| Knip (unused code)        | a file, export or dependency nothing uses                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Test Conventions          | `@jterrazz/test`'s checker refused a spec — its own manual owns the id                                                                                                                                                                                                                                                                                                                                                                                     |
| Docs (layout)             | the repository's `docs/` breaks the manual's spine, or holds a generated `reference/`                                                                                                                                                                                                                                                                                                                                                                      |
| Publish (packaging)       | the `exports` map promises a file the tarball does not carry, or a shipped file is compiled from test material                                                                                                                                                                                                                                                                                                                                             |
| Architecture (layer map)  | an import crosses a layer of a preset (the base preset's `lint/` direction included), of `typescript.architecture` or of the project's own `.dependency-cruiser.*` (`architecture/<name>`, at its line); a recorded `architecture/<name>` count grew (`typescript baseline`) or fell (`typescript fix`); the map does not load or has nothing to cruise                                                                                                    |
| Astro (check + format)    | `astro check` or prettier refused a `.astro` file                                                                                                                                                                                                                                                                                                                                                                                                          |
| Suppressions (directives) | a lint directive is misspelled or unreasoned                                                                                                                                                                                                                                                                                                                                                                                                               |
| Markdown (prose)          | rumdl refused a page (`MD057` a missing link, `MD051` a missing anchor, `MD040` a fence with no language — `typescript fix`), a page cites a path that is gone, or a block runs past its floor                                                                                                                                                                                                                                                             |
| Names (tree)              | a directory is not kebab-case, a name says nothing, names a construct (`types.ts`), is written in half, a skill holds more than its `SKILL.md`, a root sits outside the spine undeclared, `jterrazz.config.ts` does not load, an entry is not named for its subpath, an `index` publishes nothing, a `.bin` publishes no bin, a published subpath has no source, the `Makefile` misses one of the six gestures, or a directory is empty — `typescript fix` |
| Comments (density)        | the source holds a different number of comment lines than `comments/comment-lines-held-by-the-baseline` records — delete or rename, `typescript fix` records a fall                                                                                                                                                                                                                                                                                        |
| Secrets (credentials)     | a committed line looks like a live credential                                                                                                                                                                                                                                                                                                                                                                                                              |

The drift report closes the run; its one refusal is a profile rule turned off with no `// reason:` beside it.

## Before writing

- A file is named for its subject in the domain: never `types.ts`, `utils.ts`, `constants.ts`, nor a `*.types.ts` suffix. An `index` is an entry the package publishes, named `index[.<subpath>][.browser].ts` for its subpath, and a bin `<command>.bin.ts`, named for the command it publishes — `.bin` marks only a published bin, and a program the package does not publish is named for what it runs — `docs/06-quality-checks.md`, The entry grammar.
- A file holds 300 lines and a function 60; a `*.spec.ts` is `@jterrazz/test`'s `spec-file-within-line-limit`, at 400 — `docs/07-lint-presets.md`.
- The default is no comment: a name carries the meaning. A comment longer than the function it sits on fails `jterrazz-typescript/comment-no-longer-than-its-function`; context that lives outside the codebase is kept with `// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the context>`.
- A suppression carries its reason: `// oxlint-disable-next-line <rule> -- why`, and `@ts-expect-error` with a description.
- Every artefact lives under `.artifacts/<tool>/`; `dist/` is the product, not an artefact.
- A `knip.json` ignore carries a `//` reason above it — the file is read as JSONC.
- The API is the types: there is no generated reference, and `docs/` never holds one.
- A repository root holds `src/`, `lint/`, `specs/`, `docs/`, `skills/` — any other root folder fails Names (tree) unless the ecosystem imposes it (`bin/`, `public/`, `app/`…) or `jterrazz.config.ts` declares it under `typescript.roots` with a reason.
- A `lint/` holds at its root the modules that compose it — its entries, its bins, what `src/` reads — and three folders: `consumer/` and `self/` hold declarations alone, and `engine/` holds the code that runs them — `docs/06-quality-checks.md`, The lint tree.
- A repository's root `Makefile` answers `make install`, `build`, `lint`, `fix`, `test` and `check`; a workspace member owes none of them.
- What a package holds a project to reaches it through the preset the project lists under `presets` in `jterrazz.config.ts`, after the base `typescript()` that is always on; the project's own layers, roots and name rules go in its `typescript` section, and a preset's law is set aside only under `optOuts`, with its reason — `docs/09-rules-kit.md`, Presets.
- A rule a package writes for its consumers is written with `@jterrazz/typescript/rules` — `docs/09-rules-kit.md`.
- A local `compilerOption` is a smell — the preset is where the fix belongs.

## The chapter to read next

| Question                                                                                                                         | Chapter                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| what the toolchain is, the four ideas to hold (profile, settings file, two commands, baseline), and which chapter to read first  | `README.md`, then `docs/README.md` |
| the layers, the exports map, the two compilers                                                                                   | `docs/01-architecture.md`          |
| wiring a project, `.artifacts/`, a bump                                                                                          | `docs/02-developing.md`            |
| how this toolchain proves itself, and the rules it keeps for its own suite — this repository alone, the install ships without it | `docs/03-testing.md`               |
| which number moves on a release                                                                                                  | `docs/04-operating.md`             |
| `build`, `bundle`, `start`, `dev`                                                                                                | `docs/05-building.md`              |
| a failing pass, a rule id, the baseline                                                                                          | `docs/06-quality-checks.md`        |
| a lint rule, a profile, `compose()`, knip                                                                                        | `docs/07-lint-presets.md`          |
| what a repository root holds                                                                                                     | `docs/08-repo-structure.md`        |
| a preset, the merge order, an opt-out; writing a rule, a check or its chapter with the kit                                       | `docs/09-rules-kit.md`             |
