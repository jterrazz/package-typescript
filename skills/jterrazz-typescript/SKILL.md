---
name: jterrazz-typescript
description: Build tooling for the @jterrazz ecosystem — defines how all projects build, bundle, and generate docs. Powered by tsdown + typedoc. Activates when creating, configuring, or debugging TypeScript builds.
---

# @jterrazz/typescript

Part of the @jterrazz ecosystem. Defines how all projects build and generate docs.

Zero-config TypeScript build tooling powered by tsdown (Rust) + typedoc.

## Commands

```bash
typescript build      # Build application — ESM + .d.ts + sourcemaps
typescript bundle     # Bundle library — ESM + CJS + .d.ts + sourcemaps
typescript start      # Run dist/index.js with source maps
typescript dev        # Watch mode — rebuild + run on file changes
typescript docs       # Generate API reference + llms.txt from TSDoc
```

## Setup

```bash
npm install @jterrazz/typescript
```

**tsconfig.json** — pick one:

```json
{ "extends": "@jterrazz/typescript/presets/tsconfig/node" }
{ "extends": "@jterrazz/typescript/presets/tsconfig/next" }
{ "extends": "@jterrazz/typescript/presets/tsconfig/expo" }
```

**package.json scripts** — for apps:

```json
{
    "build": "typescript build",
    "start": "typescript start",
    "dev": "typescript dev"
}
```

**package.json scripts** — for libraries:

```json
{
    "build": "typescript bundle",
    "docs": "typescript docs"
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
        uses: jterrazz/jterrazz-workflows/.github/workflows/docs.yaml@main
```

Add `.docs` to `.gitignore` — it's a build artifact, not committed.

## Always

- Entry point is `src/index.ts`
- Use `.js` extensions in relative imports: `import { foo } from "./bar.js"`
- Add TSDoc to all public exports — `typescript docs` derives everything from it
