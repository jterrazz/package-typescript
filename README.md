# @jterrazz/codestyle

Fast, opinionated linting and formatting for TypeScript. Powered by Oxlint, Oxfmt, tsgo, and Knip.

## Quick Start

```bash
npm install @jterrazz/codestyle --save-dev
```

Create `oxlint.config.ts`:

```ts
import { defineConfig } from 'oxlint';
import { oxlint } from '@jterrazz/codestyle';

export default defineConfig({
    extends: [oxlint.node],
});
```

Create `oxfmt.config.ts`:

```ts
import { defineConfig } from 'oxfmt';
import { oxfmt } from '@jterrazz/codestyle';

export default defineConfig(oxfmt);
```

Run:

```bash
npx codestyle check   # Check everything (types + lint + format + unused code)
npx codestyle fix     # Fix lint and formatting issues
```

## Presets

Pick a base config:

| Preset        | Use Case                          |
| ------------- | --------------------------------- |
| `oxlint.node` | Node.js (requires .js extensions) |
| `oxlint.expo` | Expo / React Native               |
| `oxlint.next` | Next.js                           |

Architecture preset (additive):

| Preset             | Use Case                           |
| ------------------ | ---------------------------------- |
| `oxlint.hexagonal` | Hexagonal architecture enforcement |

## Architecture Enforcement

Enforce hexagonal architecture boundaries:

```ts
import { defineConfig } from 'oxlint';
import { oxlint } from '@jterrazz/codestyle';

export default defineConfig({
    extends: [oxlint.node, oxlint.hexagonal],
});
```

Rules enforced:

- `domain/` cannot import from other layers
- `application/` cannot import infrastructure
- `presentation/ui/` cannot import navigation
- `features/` cannot import other features

## Unused Code Detection

`codestyle check` runs [Knip](https://knip.dev/) to detect unused files, exports, and dependencies. A base config is automatically merged with any project-local `knip.json`, handling common ecosystem patterns:

- `@jterrazz/*` packages auto-ignored
- Published libraries: `exports`/`types`/`files` rules auto-disabled
- Convention paths (`fixtures/`, `expected/`, `docs/`) auto-ignored
- Plugin dependencies (`*-plugin-*`, `@scope/*`) auto-ignored

For fine-tuning, create a `knip.json` with only project-specific overrides.

## What Runs

`codestyle check` runs four tools in parallel:

| Tool   | Purpose              |
| ------ | -------------------- |
| tsgo   | Type checking        |
| oxlint | Linting              |
| oxfmt  | Formatting           |
| knip   | Unused code analysis |

`codestyle fix` runs three tools in parallel (knip excluded):

| Tool   | Purpose              |
| ------ | -------------------- |
| tsgo   | Type checking        |
| oxlint | Linting (with --fix) |
| oxfmt  | Formatting           |
