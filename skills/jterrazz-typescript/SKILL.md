---
name: jterrazz-typescript
description: Use when building, checking, linting, formatting, or configuring a TypeScript project with @jterrazz/typescript — build/bundle/dev/start, typescript check|fix failures, oxlint/oxfmt/knip/tsconfig presets, compose() lint config, docs generation command.
---

# @jterrazz/typescript

The complete TypeScript toolchain for the @jterrazz ecosystem — defines how every project builds, lints, formats, and documents. Zero-config, fully compiled: tsdown/Rolldown (Rust) for builds, oxlint/oxfmt (Rust) for lint and format, tsc (TypeScript 7, Go) for type checking, knip for unused code, typedoc for API docs.

## Mental model

Three surfaces, one CLI (`bin/typescript.sh`):

- **Build** — `build` (app: ESM + types), `bundle` (library: ESM + CJS + types), `start`, `dev`.
- **Check** — `check` runs tsc + oxlint + oxfmt + knip in parallel (plus a conventions pass and a docs-sync pass when the project qualifies); `fix` auto-repairs lint + format.
- **Docs** — `docs` compiles the source barrel into a **committed** projection (`docs/reference/`); `docs --check` verifies it is in sync.

Lint/format/tsconfig are preset packages a project wires explicitly in its own config files. There is no dependency auto-detection in the presets.

## Where to look

The full knowledge lives in the package's own corpus — route into it, do not restate it. Read the relevant chapter straight from the repo:

| Task                                               | Chapter                      |
| -------------------------------------------------- | ---------------------------- |
| Setting up a project                               | `docs/01-getting-started.md` |
| Build issues (build/bundle/start/dev)              | `docs/02-building.md`        |
| `check` / `fix` failing                            | `docs/03-quality-checks.md`  |
| Lint rules, presets, `compose`, architecture, knip | `docs/04-lint-presets.md`    |
| Docs pipeline (`typescript docs`)                  | `docs/05-docs-pipeline.md`   |

Organizing the repo itself — where knowledge lives, corpus vs skills vs the compiler — is a separate capability: see the `jterrazz-repo-structure` skill.

## Quick setup

```bash
npm install @jterrazz/typescript --save-dev
```

```json
// tsconfig.json — pick one
{ "extends": "@jterrazz/typescript/tsconfig/node" } // or /next, /expo
```

```ts
// oxlint.config.ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';
export default defineConfig({ extends: [oxlint.node] }); // or oxlint.next, oxlint.expo
```

```ts
// oxfmt.config.ts
import { oxfmt } from '@jterrazz/typescript';
import { defineConfig } from 'oxfmt';
export default defineConfig(oxfmt);
```

Projects using `@jterrazz/test` compose its lint fragment explicitly:

```ts
import { testing } from '@jterrazz/test/oxlint';
import { compose, node } from '@jterrazz/typescript/oxlint';
export default compose(node, testing);
```

## Always

- Entry point is `src/index.ts` (the single public barrel); use `.js` extensions in relative imports.
- Add TSDoc to every public export — `typescript docs` derives the reference from it.
- Run `typescript fix` before committing, not just `typescript check`.
- `typescript docs` writes a **committed** projection under `docs/reference/` — commit it, and regenerate in the same change that touches the source (`check` runs a Docs sync pass). Never hand-edit a generated file, and never gitignore `docs/`.
