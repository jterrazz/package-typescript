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

Every preset scopes its `include` and `exclude` to `${configDir}` — the directory of the `tsconfig.json` that extends it — so a project inherits the right file set without restating one.

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

## The shape a consumer keeps

That is the whole contract, and it is meant to stay that size:

- **One devDependency** — `@jterrazz/typescript`. tsc, oxlint, oxfmt, knip, tsdown and typedoc are its own dependencies and arrive with it; installing one of them directly gives a project two opinions about its own toolchain, and the versions drift apart from there.
- **Two commands** — `typescript check` and `typescript fix`. Every gate is behind them, so a script that calls a tool underneath skips the passes the CLI orchestrates.
- **One line of tsconfig** — the `extends` above, and nothing beside it. In a workspace that is one line per member: the unit the toolchain measures from is the package, not the repository ([Quality checks](03-quality-checks.md)).

A local `compilerOption` is a **smell, not a shortcut**. It says the preset lacks something, and it settles that lack for one project in a place nobody else reads — so the next project rediscovers the same gap and answers it differently. Name what is missing and change the preset instead: the fix belongs upstream, where every project gets the same answer.

## Conventions

- Entry point is `src/index.ts` — the single public barrel.
- Use `.js` extensions in relative imports: `import { foo } from './bar.js'`.
- Add TSDoc to every public export — `typescript docs` derives the reference from it.

## Related

- [Building](02-building.md) — build, bundle, start, dev.
- [Quality checks](03-quality-checks.md) — `check` / `fix`.
- [Repo structure](06-repo-structure.md) — how a repo is organized.
