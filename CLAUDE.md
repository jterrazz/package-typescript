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

## Two typescript packages, on purpose

Dependencies include both `typescript` (^6, JS API) and `typescript-go`
(npm alias of the official `typescript@7` Go compiler). `typescript check`
type-checks with the fast Go `tsc` (resolved by path via the alias in
`check.sh`), while typedoc and eslint-plugin-perfectionist still require the
JS API and resolve the name `typescript` to v6. Declaring both pins peer
resolution deterministically under npm AND pnpm — do not "simplify" to a
single `typescript@7` dep: it breaks perfectionist (no JS API) and typedoc
(peer range 5–6).

## What the CLI provides to consumers

- `typescript build` — ESM app build via tsdown
- `typescript bundle` — ESM + CJS library bundle via tsdown
- `typescript start` — Run dist/index.js with source maps
- `typescript dev` — Watch + rebuild + run
- `typescript docs` — Generate API reference + llms.txt + llms-full.txt from TSDoc (no typedoc.json needed)
- `typescript check` — Type check (tsc, TypeScript 7) + lint (oxlint) + format check (oxfmt) + unused code (knip), in parallel
- `typescript fix` — Auto-fix lint and formatting issues
