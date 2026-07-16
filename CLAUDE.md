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
tests/
├── e2e/                   # CLI command tests (build, bundle, dev, start, cli)
│   └── check/             # Quality check tests (linter, formatter, typechecker, knip, architecture)
├── fixtures/              # Sample projects for testing
└── setup/                 # Test spec runners
skills/jterrazz-typescript/SKILL.md
```

## Conventions

This repo follows the `jterrazz-stack` skill for cross-cutting concerns.

## Two TypeScript compilers, on purpose

`typescript check` type-checks with the official TypeScript 7 Go compiler,
pulled in via the per-platform `@typescript/typescript-*` optionalDependencies
(resolved by path in `check.sh`). The regular `typescript` dependency stays on
^6 because typedoc (peer range 5–6) and eslint-plugin-perfectionist (bare
`require('typescript')`) need the JS compiler API, which the Go package no
longer ships. Never add `typescript@7` (or an npm alias of it) to the tree:
under pnpm's hoist fallback it can hijack perfectionist's typescript lookup
(`isExternalModuleNameRelative is not a function`), intermittently.

## What the CLI provides to consumers

- `typescript build` — ESM app build via tsdown
- `typescript bundle` — ESM + CJS library bundle via tsdown
- `typescript start` — Run dist/index.js with source maps
- `typescript dev` — Watch + rebuild + run
- `typescript docs` — Generate API reference + llms.txt + llms-full.txt from TSDoc (no typedoc.json needed)
- `typescript check` — Type check (tsc, TypeScript 7) + lint (oxlint) + format check (oxfmt) + unused code (knip), in parallel
- `typescript fix` — Auto-fix lint and formatting issues
