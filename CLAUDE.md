# Agent brief — `@jterrazz/typescript`

Zero-config TypeScript build tooling + API docs generation for the @jterrazz ecosystem.

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

No build step — this package ships JS directly.

## Repo layout

```
bin/
├── typescript.sh          # Main CLI entry point (build, bundle, start, dev, docs)
└── generate-docs.sh       # Docs generation logic (typedoc + llms.txt)
presets/
├── tsconfig/              # TypeScript config presets (node, next, expo)
└── tsdown/                # Build config presets (build.js, bundle.js)
tests/
├── e2e/                   # CLI command tests (build, bundle, dev, start, cli)
├── fixtures/              # Sample projects for testing
└── setup/                 # Test spec runner
skills/jterrazz-typescript/SKILL.md
```

## Conventions

This repo follows the `jterrazz-stack` skill for cross-cutting concerns.

## What the CLI provides to consumers

- `typescript build` — ESM app build via tsdown
- `typescript bundle` — ESM + CJS library bundle via tsdown
- `typescript start` — Run dist/index.js with source maps
- `typescript dev` — Watch + rebuild + run
- `typescript docs` — Generate API reference + llms.txt + llms-full.txt from TSDoc (no typedoc.json needed)
