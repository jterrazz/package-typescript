# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds, quality checks, and API docs generation. Zero config for consumers.

## Setup

```bash
npm install
```

## Commands

| Task                             | Command            |
| -------------------------------- | ------------------ |
| Run all tests                    | `npm test`         |
| Lint + format + typecheck + knip | `npm run lint`     |
| Auto-fix lint issues             | `npm run lint:fix` |

No build step — this package ships JS directly. The repo dogfoods its own CLI (`npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/
├── typescript.sh          # CLI entry point (build, bundle, start, dev, docs, check, fix)
└── commands/
    ├── check.sh           # Quality checks: tsc + oxlint + oxfmt + knip in parallel
    └── docs.sh            # Docs generation logic (typedoc + llms.txt)
lib/
└── merge-knip-config.js   # Merges knip base preset with project-local knip.json
presets/
├── tsconfig/              # TypeScript config presets (node, next, expo)
├── tsdown/                # Build config presets (build.js, bundle.js)
├── oxlint/                # Lint presets (base, node, next, expo) + hexagonal architecture
├── oxfmt/                 # Format preset
└── knip/                  # Unused-code base config
src/index.js               # Package entry — exports { oxlint, oxfmt } presets for configs
specs/                     # Product specifications (@jterrazz/test, CONVENTIONS C1': facet → domain)
├── cli/                   # THE facet — runners at its root, tests in domain folders
│   ├── cli.specification.ts        # THE product runner (bin/typescript.sh) — every spec goes through real product commands
│   ├── oxlint.specification.ts     # b9w-suppressed exception: asserts the shipped oxlint PRESETS (`-c <preset>`)
│   ├── oxfmt.specification.ts      # b9w-suppressed exception: asserts the shipped oxfmt PRESET
│   ├── resolution.specification.ts # sandbox runner (run-split-install.sh → real check.sh in a synthetic install tree)
│   ├── check/             # cli.exec('check'/'fix'): kitchen-sink golden files + per-tool aspects (linter, architecture, knip, typechecker, formatter)
│   ├── build/             # build.test.ts + bundle.test.ts
│   ├── dev/ · start/ · help/ · preset/  # remaining domains
│   └── */fixtures/, */expected/    # domain-local assets (fixture projects, golden snapshots)
└── fixtures/              # SHARED pool via .fixture('$FIXTURES/…'): sample-app, sample-lib, broken-app
skills/jterrazz-typescript/SKILL.md
```

## Conventions

This repo follows the `jterrazz-stack` skill for cross-cutting concerns, plus the `@jterrazz/test` CONVENTIONS (machine-enforced via the auto-wired oxlint plugin):

- **Layout (C1')** — runners (`*.specification.ts`) sit at the facet root (`specs/cli/`); tests sit at facet/domain depth (`specs/cli/<domain>/<aspect>.test.ts`). Never a test at the facet root, never a runner inside a domain.
- **Single real runner (B9)** — specs exercise the PRODUCT command (`cli.exec('check')`, `cli.exec('build')`…), never a third-party binary in `node_modules/.bin`. The two preset runners (oxlint/oxfmt) are sanctioned, reason-commented `b9w-product-command` suppressions: the product they guard IS the preset, and `typescript check` cannot load a preset inside a temp-workdir fixture.
- **Golden files (D11)** — tool output is asserted as full snapshots per scoped use case (`expect(result.stdout).toMatch('<name>.txt')`, tokens like `{{duration}}` for volatile parts, regenerate with `TEST_UPDATE=1`). The kitchen-sink fixture + `check.txt`/`fix.txt` is the whole-surface regression net (it churns — that's its role). `.grep()` is the scalpel for targeted presence/absence probes (the per-rule preset assertions).
- **Titles (J5)** — `test('…')`/`describe('…')` titles start lowercase. Every test carries `// Given -` and `// Then -` comments.

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler,
pulled in via the per-platform `@typescript/typescript-*` optionalDependencies
(resolved by path in `check.sh`). The regular `typescript` dependency stays on
^6 because typedoc (peer range 5–6) and eslint-plugin-perfectionist (bare
`require('typescript')`) need the JS compiler API, which the Go package no
longer ships. Never add `typescript@7` (or an npm alias of it) to the tree:
under pnpm's hoist fallback it can hijack perfectionist's typescript lookup
(`isExternalModuleNameRelative is not a function`), intermittently.

## Composable lint presets — explicit wiring

`@jterrazz/typescript/oxlint` exports the named presets (`node`, `expo`, `next`, `hexagonal`) plus `compose(...fragments)` — deterministic merge: `jsPlugins`/`plugins`/`ignorePatterns`/`extends` concatenated + deduped, `rules`/`categories` shallow-merged (last wins), `overrides` concatenated. There is NO dependency auto-detection in the presets: a project using `@jterrazz/test` composes its `testing` fragment explicitly:

```typescript
import { testing } from '@jterrazz/test/oxlint';
import { compose, node } from '@jterrazz/typescript/oxlint';

export default compose(node, testing);
```

This repo's own `oxlint.config.ts` is consumer #1 of that pattern (self-reference through the exports map). Detection survives ONLY as orchestration in `check.sh`: the `jterrazz-test-check` conventions step runs when the project depends on `@jterrazz/test` AND has a `specs/` directory (a runner decision, not config identity), and the loud CommonJS-config warning stays.

## What the CLI provides to consumers

- `typescript build` — ESM app build via tsdown
- `typescript bundle` — ESM + CJS library bundle via tsdown
- `typescript start` — Run dist/index.js with source maps
- `typescript dev` — Watch + rebuild + run
- `typescript docs` — Generate API reference + llms.txt + llms-full.txt from TSDoc (no typedoc.json needed)
- `typescript check` — Type check (tsc, TypeScript 7) + lint (oxlint) + format check (oxfmt) + unused code (knip), in parallel
- `typescript fix` — Auto-fix lint and formatting issues
