---
name: jterrazz-typescript
description: Use when building, checking, linting, formatting, or configuring a TypeScript project with @jterrazz/typescript — build/bundle/dev/start, typescript check|fix failures, oxlint/oxfmt/knip/tsconfig presets, compose() lint config, docs generation command.
---

# @jterrazz/typescript

The complete TypeScript toolchain for the @jterrazz ecosystem — defines how every project builds, lints, formats, and documents. Zero-config, fully compiled: tsdown/Rolldown (Rust) for builds, oxlint/oxfmt (Rust) for lint and format, tsc (TypeScript 7, Go) for type checking, knip for unused code, typedoc for API docs.

## Mental model

Three surfaces, one CLI (`bin/typescript.sh`):

- **Build** — `build` (app: ESM + types), `bundle` (library: ESM + CJS + types), `start`, `dev`, `clean`.
- **Check** — `check` runs up to fifteen passes in parallel, each printing a header and a verdict in one fixed order: tsc, oxlint (`--type-aware`), oxfmt, the artefact gate, knip, the conventions checker, the two Docs passes, publish, architecture, Astro, and the four tree gates — suppressions, markdown, names, secrets. A pass that does not apply prints nothing. It ends on a drift report. `fix` auto-repairs lint + format, rewrites the `.gitignore`, settles suppression spellings and formats `.astro`.
- **Adopt** — `doctor` reports the installed tool versions against the declared ranges; `baseline` records `oxlint.baseline.json`, the ratchet a project adopts a stricter release with.
- **Docs** — `docs` compiles the source barrel into a **committed** projection (`docs/reference/`); `docs --check` verifies it is in sync.

A project names ONE of seven profiles — `node`, `library`, `next`, `astro`, `expo`, `bun`, `react` — in its `oxlint.config.ts`, and the matching tsconfig preset in its `tsconfig.json`. Every rule of every loaded plugin is decided by name, at `error` or at `off` with one of five recorded reasons; there is no warn tier, and a profile never relaxes what the profiles share. There is no dependency auto-detection.

## Where to look

The full knowledge lives in the package's own corpus — route into it, do not restate it. Read the relevant chapter straight from the repo:

| Task                                                | Chapter                     |
| --------------------------------------------------- | --------------------------- |
| Setting up a project                                | `docs/02-developing.md`     |
| Where a tool's output goes (`.artifacts/`)          | `docs/02-developing.md`     |
| Build issues (build/bundle/start/dev)               | `docs/05-building.md`       |
| `check` / `fix` failing                             | `docs/06-quality-checks.md` |
| The shape of `docs/` (the spine, the lint)          | `docs/06-quality-checks.md` |
| Lint rules, profiles, `compose`, architecture, knip | `docs/07-lint-presets.md`   |
| Whether a specific rule is on, and why              | `references/rules.md`       |
| Docs pipeline (`typescript docs`)                   | `docs/08-docs-pipeline.md`  |

Organizing the repo itself — where knowledge lives, corpus vs skills vs the compiler — is a separate capability: see the `jterrazz-repo-structure` skill, which ships from [`jterrazz-studio`](https://github.com/jterrazz/jterrazz-studio).

## Quick setup

```bash
npm install @jterrazz/typescript --save-dev
```

```json
// tsconfig.json — the profile's preset: /node, /library, /next, /expo, /react
// (astro and bun sit on /node)
{ "extends": "@jterrazz/typescript/tsconfig/node" }
```

```ts
// oxlint.config.ts — the same word as the tsconfig preset
import { defineConfig, node } from '@jterrazz/typescript/oxlint';
export default defineConfig(node); // or library, next, astro, expo, bun, react
```

```ts
// oxfmt.config.ts
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';
export default defineConfig(base);
```

A config imports `@jterrazz/typescript` and nothing else — `defineConfig` included. Naming `oxlint` or `oxfmt` directly breaks under pnpm's strict `node_modules` (`ERR_MODULE_NOT_FOUND`), where only what the project declares resolves.

Projects using `@jterrazz/test` compose its lint fragment explicitly:

```ts
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';
export default defineConfig(compose(node, testing));
```

Under the `library` profile alone, `isolatedDeclarations` refuses a default export it would have to infer, so both config files name the type:

```ts
import { defineConfig, library, type OxlintConfig } from '@jterrazz/typescript/oxlint';
const config: OxlintConfig = defineConfig(library);
export default config;
```

## Always

- Entry point is `src/index.ts` (the single public barrel); use `.js` extensions in relative imports.
- Add TSDoc to every public export — `typescript docs` derives the reference from it.
- Run `typescript fix` before committing, not just `typescript check`.
- A suppression carries its reason: `// oxlint-disable-next-line <rule> -- why`, and `@ts-expect-error` with a description. `eslint-disable`, `biome-ignore` and `@ts-ignore` are refused.
- Turning a profile rule off in `oxlint.config.ts` needs a `// reason:` comment on that line, or the drift report refuses the run.
- The oxlint config is ESM — `oxlint.config.ts` or `.mjs`. A CommonJS one is dropped whole and in silence by oxlint, and `check` fails the run for it.
- After a bump: `typescript doctor` reads the installed tools against the declared ranges, and `typescript baseline` records today's diagnostics where the bump lands red — the count may then only fall.
- A `knip.json` entry carries its reason: the file is read as JSONC, so a `//` line above an ignore says why it is there.
- Every artefact lives under `.artifacts/<tool>/` at the project root, and `.artifacts/` is gitignored; `dist` is the one exception (the product). `typescript clean` empties it — see `docs/02-developing.md`.
- `typescript docs` writes a **committed** projection under `docs/reference/` — commit it, and regenerate in the same change that touches the source (`check` runs a Docs sync pass). Never hand-edit a generated file, and never gitignore `docs/`.
