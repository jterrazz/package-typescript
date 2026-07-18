# Getting started

Install `@jterrazz/typescript` and point three config files at its presets — the toolchain is zero-config beyond that.

```bash
npm install @jterrazz/typescript --save-dev
```

## 1. Choose a TypeScript configuration

Extend one of the shipped presets from `tsconfig.json`:

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }  // Node.js projects
{ "extends": "@jterrazz/typescript/tsconfig/next" }  // Next.js projects
{ "extends": "@jterrazz/typescript/tsconfig/expo" }  // Expo / React Native
```

## 2. Create the lint and format configs

```ts
// oxlint.config.ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({ extends: [oxlint.node] });
```

```ts
// oxfmt.config.ts
import { oxfmt } from '@jterrazz/typescript';
import { defineConfig } from 'oxfmt';

export default defineConfig(oxfmt);
```

## 3. Wire the CLI into package.json

Applications:

```json
{
    "build": "typescript build",
    "start": "typescript start",
    "dev": "typescript dev",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

Libraries (bundle instead of build, and generate docs):

```json
{
    "build": "typescript bundle",
    "docs": "typescript docs",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

## Conventions

- Entry point is `src/index.ts` — the single public barrel.
- Use `.js` extensions in relative imports: `import { foo } from './bar.js'`.
- Add TSDoc to every public export — `typescript docs` derives the reference from it.

## Related

- [Building](02-building.md) — build, bundle, start, dev.
- [Quality checks](03-quality-checks.md) — `check` / `fix`.
- [Repo structure](06-repo-structure.md) — how a repo is organized.
