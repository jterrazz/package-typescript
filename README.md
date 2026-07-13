# @jterrazz/typescript

The complete TypeScript toolchain — build, run, check, and document with zero configuration. Powered by tsdown, Oxlint, Oxfmt, tsgo, and Knip.

## Installation

```bash
npm install @jterrazz/typescript --save-dev
```

## Setup

### 1. Choose a TypeScript configuration

```json
// tsconfig.json - Pick one:
{ "extends": "@jterrazz/typescript/tsconfig/node" }  // Node.js projects
{ "extends": "@jterrazz/typescript/tsconfig/next" }  // Next.js projects
{ "extends": "@jterrazz/typescript/tsconfig/expo" }  // Expo/React Native
```

### 2. Create the lint and format configs

```ts
// oxlint.config.ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [oxlint.node],
});
```

```ts
// oxfmt.config.ts
import { oxfmt } from '@jterrazz/typescript';
import { defineConfig } from 'oxfmt';

export default defineConfig(oxfmt);
```

### 3. Use the CLI

```bash
npx typescript build       # Build application (ESM + types)
npx typescript bundle      # Bundle library (ESM + CJS + types)
npx typescript start       # Run the built application
npx typescript dev         # Build, run, and rebuild on changes
npx typescript docs        # Generate API reference + llms.txt
npx typescript check       # Check types, lint, formatting, and unused code
npx typescript fix         # Auto-fix lint and formatting issues
```

## Building

- **Blazing fast** — Powered by [tsdown](https://tsdown.dev) / [Rolldown](https://rolldown.rs) (Rust)
- **Zero configuration** — Works out of the box
- **Multiple outputs** — ESM + CommonJS + TypeScript declarations
- **Source maps** — Full debugging support

| Command             | Output            | Description              |
| ------------------- | ----------------- | ------------------------ |
| `typescript build`  | `dist/index.js`   | ESM bundle               |
|                     | `dist/index.d.ts` | TypeScript declarations  |
| `typescript bundle` | `dist/index.js`   | ESM bundle               |
|                     | `dist/index.cjs`  | CommonJS bundle          |
|                     | `dist/index.d.ts` | TypeScript declarations  |
| `typescript start`  | —                 | Runs `dist/index.js`     |
| `typescript dev`    | `dist/index.js`   | Watch + rebuild + run    |
| `typescript docs`   | `.docs/`          | API reference + llms.txt |

### Project structure

```
your-project/
├── src/
│   ├── index.ts           # Main entry point
│   └── instrumentation.ts # Optional instrumentation entry point
├── dist/                  # Generated files
└── tsconfig.json          # Extends this package
```

## Quality checks

`typescript check` runs four tools in parallel:

| Tool   | Purpose              |
| ------ | -------------------- |
| tsgo   | Type checking        |
| oxlint | Linting              |
| oxfmt  | Formatting           |
| knip   | Unused code analysis |

`typescript fix` runs tsgo, oxlint (with `--fix`), and oxfmt in parallel (knip excluded).

### Lint presets

| Preset        | Use Case                          |
| ------------- | --------------------------------- |
| `oxlint.node` | Node.js (requires .js extensions) |
| `oxlint.expo` | Expo / React Native               |
| `oxlint.next` | Next.js                           |

### Architecture enforcement

Enforce hexagonal architecture boundaries with the additive `oxlint.hexagonal` preset:

```ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [oxlint.node, oxlint.hexagonal],
});
```

Rules enforced:

- `domain/` cannot import from other layers
- `application/` cannot import infrastructure
- `presentation/ui/` cannot import navigation
- `features/` cannot import other features

### Unused code detection

`typescript check` runs [Knip](https://knip.dev/) to detect unused files, exports, and dependencies. A base config is automatically merged with any project-local `knip.json`, handling common ecosystem patterns:

- `@jterrazz/*` packages auto-ignored
- Published libraries: `exports`/`types`/`files` rules auto-disabled
- Convention paths (`fixtures/`, `expected/`, `docs/`) auto-ignored
- Plugin dependencies (`*-plugin-*`, `@scope/*`) auto-ignored

For fine-tuning, create a `knip.json` with only project-specific overrides.

## API docs generation

`typescript docs` reads TSDoc from `src/index.ts` and generates:

- **Typedoc markdown** — Full API reference under `.docs/`
- **`llms.txt`** — Structured index following the [llms.txt standard](https://llmstxt.org/)
- **`llms-full.txt`** — Complete reference in one file for LLM context windows

No `typedoc.json` needed. Pair with the shared CI workflow to auto-deploy:

```yaml
# .github/workflows/docs.yaml
jobs:
    docs:
        uses: jterrazz/jterrazz-actions/.github/workflows/docs.yaml@main
```

## How it works

The toolchain is fully compiled — no JavaScript in the hot path:

| Step         | Tool                                               | Language |
| ------------ | -------------------------------------------------- | -------- |
| Transpile    | [Oxc](https://oxc.rs) (via tsdown)                 | Rust     |
| Bundle       | [Rolldown](https://rolldown.rs)                    | Rust     |
| Declarations | [tsdown](https://tsdown.dev) built-in              | Rust     |
| Type check   | [tsgo](https://github.com/microsoft/typescript-go) | Go       |
| Lint         | [Oxlint](https://oxc.rs/docs/guide/usage/linter)   | Rust     |
| Format       | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) | Rust     |
| Unused code  | [Knip](https://knip.dev)                           | Node     |
| API docs     | [Typedoc](https://typedoc.org)                     | Node     |

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
