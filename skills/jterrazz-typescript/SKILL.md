---
name: jterrazz-typescript
description: Use when building, bundling, linting, formatting, type-checking, or generating docs for a TypeScript project. Covers tsconfig setup, tsdown builds (ESM/CJS), dev mode, `typescript check`/`typescript fix`, oxlint/oxfmt presets, knip, hexagonal architecture enforcement, and API docs via `typescript docs`.
---

# @jterrazz/typescript

Part of the @jterrazz ecosystem. The complete TypeScript toolchain — defines how all projects build, lint, format, and generate docs.

Zero-config, fully compiled toolchain: tsdown/Rolldown (Rust) for builds, oxlint/oxfmt (Rust) for lint and format, tsgo (Go) for type checking, knip for unused code, typedoc for API docs.

## Commands

```bash
typescript build      # Build application — ESM + .d.ts + sourcemaps
typescript bundle     # Bundle library — ESM + CJS + .d.ts + sourcemaps
typescript start      # Run dist/index.js with source maps
typescript dev        # Watch mode — rebuild + run on file changes
typescript docs       # Generate API reference + llms.txt from TSDoc
typescript check      # Check everything — types + lint + format + unused code
typescript fix        # Auto-fix lint and formatting issues
```

## Setup

```bash
npm install @jterrazz/typescript --save-dev
```

**tsconfig.json** — pick one:

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }
{ "extends": "@jterrazz/typescript/tsconfig/next" }
{ "extends": "@jterrazz/typescript/tsconfig/expo" }
```

**`oxlint.config.ts`** — pick a preset:

```ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({ extends: [oxlint.node] }); // or oxlint.next, oxlint.expo
```

**`oxfmt.config.ts`**:

```ts
import { oxfmt } from '@jterrazz/typescript';
import { defineConfig } from 'oxfmt';

export default defineConfig(oxfmt);
```

**package.json scripts** — for apps:

```json
{
    "build": "typescript build",
    "start": "typescript start",
    "dev": "typescript dev",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

**package.json scripts** — for libraries:

```json
{
    "build": "typescript bundle",
    "docs": "typescript docs",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

**package.json exports** — for libraries:

```json
{
    "exports": {
        ".": {
            "require": "./dist/index.cjs",
            "import": "./dist/index.js"
        }
    },
    "files": ["dist"]
}
```

## Output

| Command  | Files                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| `build`  | `dist/index.js`, `dist/index.d.ts` + sourcemaps                                       |
| `bundle` | `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts` + sourcemaps |
| `docs`   | `.docs/` — typedoc markdown + `llms.txt` + `llms-full.txt`                            |

## Quality checks

`typescript check` runs four tools in parallel:

| Tool   | Purpose              | Language |
| ------ | -------------------- | -------- |
| tsgo   | Type checking        | Go       |
| oxlint | Linting              | Rust     |
| oxfmt  | Formatting           | Rust     |
| knip   | Unused code analysis | Node     |

`typescript fix` runs tsgo, oxlint (with `--fix`), and oxfmt (knip excluded).

### Lint presets

| Preset             | Use case                          |
| ------------------ | --------------------------------- |
| `oxlint.node`      | Node.js — requires `.js` imports  |
| `oxlint.next`      | Next.js                           |
| `oxlint.expo`      | Expo / React Native               |
| `oxlint.hexagonal` | Hexagonal architecture (additive) |

### Architecture enforcement (optional)

Add hexagonal architecture boundary rules:

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

### Knip

A base config is automatically merged with any project-local `knip.json` — `@jterrazz/*` deps, plugin deps, and convention paths are auto-ignored. Only create a `knip.json` for project-specific overrides.

## Formatting rules

- 100 char print width
- 4-space indentation
- Single quotes
- Trailing commas
- Semicolons
- LF line endings

## Docs generation

`typescript docs` requires no configuration. It reads TSDoc from `src/index.ts` and generates:

- API reference as markdown under `.docs/`
- `llms.txt` — structured index for LLM discovery
- `llms-full.txt` — full reference in one file for LLM context windows

Deploy with the shared workflow:

```yaml
# .github/workflows/docs.yaml
jobs:
    docs:
        uses: jterrazz/jterrazz-actions/.github/workflows/docs.yaml@main
```

Add `.docs` to `.gitignore` — it's a build artifact, not committed.

## Always

- Entry point is `src/index.ts`
- Use `.js` extensions in relative imports: `import { foo } from "./bar.js"`
- Add TSDoc to all public exports — `typescript docs` derives everything from it
- Run `typescript fix` before committing, not just `typescript check`
- Never disable rules inline without a comment explaining why
- Sorting is enforced by perfectionist plugin — imports, types, object keys
