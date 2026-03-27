---
name: jterrazz-typescript
description: Build tooling for TypeScript Node.js projects using @jterrazz/typescript. Activates when creating, configuring, or debugging TypeScript builds, tsdown configs, or project scaffolding that uses this package.
---

# @jterrazz/typescript

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
{ "extends": "@jterrazz/typescript/tsconfig/node" }
{ "extends": "@jterrazz/typescript/tsconfig/next" }
{ "extends": "@jterrazz/typescript/tsconfig/expo" }
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
- Pair with `@jterrazz/codestyle` for linting
- Pair with `vitest` for testing
- Makefile must expose `build`, `lint`, `test` targets
