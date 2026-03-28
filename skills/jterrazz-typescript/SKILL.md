---
name: jterrazz-typescript
description: Build tooling for the @jterrazz ecosystem — defines how all projects build and bundle. Powered by tsdown. Activates when creating, configuring, or debugging TypeScript builds.
---

# @jterrazz/typescript

Part of the @jterrazz ecosystem. Defines how all projects build.

Zero-config TypeScript build tooling powered by tsdown (Rust).

## Commands

```bash
typescript build      # Build application — ESM + .d.ts + sourcemaps
typescript bundle     # Bundle library — ESM + CJS + .d.ts + sourcemaps
typescript start      # Run dist/index.js with source maps
typescript dev        # Watch mode — rebuild + run on file changes
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
  "build": "typescript bundle"
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

## Always

- Entry point is `src/index.ts`
- Use `.js` extensions in relative imports: `import { foo } from "./bar.js"`
