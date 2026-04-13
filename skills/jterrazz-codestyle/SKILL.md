---
name: jterrazz-codestyle
description: Code quality for the @jterrazz ecosystem — defines how all projects lint and format. Powered by tsgo, oxlint, oxfmt. Activates when configuring linting, fixing style, or enforcing architecture.
---

# @jterrazz/codestyle

Part of the @jterrazz ecosystem. Defines how all projects lint and format.

Opinionated linting + formatting + type checking + unused code detection. Runs tsgo, oxlint, oxfmt, and knip in parallel.

## Commands

```bash
codestyle check   # Check everything — types + lint + format + unused code
codestyle fix     # Auto-fix lint and formatting issues
```

## Setup

```bash
npm install @jterrazz/codestyle
```

**`oxlint.config.ts`** — pick a preset:

```ts
import { defineConfig } from 'oxlint';
import { oxlint } from '@jterrazz/codestyle';

export default defineConfig({ extends: [oxlint.node] }); // or oxlint.next, oxlint.expo
```

**`oxfmt.config.ts`**:

```ts
import { defineConfig } from 'oxfmt';
import { oxfmt } from '@jterrazz/codestyle';

export default defineConfig(oxfmt);
```

**package.json scripts:**

```json
{
    "lint": "codestyle check",
    "lint:fix": "codestyle fix"
}
```

## Presets

| Preset             | Use case                          |
| ------------------ | --------------------------------- |
| `oxlint.node`      | Node.js — requires `.js` imports  |
| `oxlint.next`      | Next.js                           |
| `oxlint.expo`      | Expo / React Native               |
| `oxlint.hexagonal` | Hexagonal architecture (additive) |

## Architecture enforcement (optional)

Add hexagonal architecture boundary rules:

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

## What runs

| Tool   | Purpose              | Language |
| ------ | -------------------- | -------- |
| tsgo   | Type checking        | Go       |
| oxlint | Linting              | Rust     |
| oxfmt  | Formatting           | Rust     |
| knip   | Unused code analysis | Node     |

## Formatting rules

- 100 char print width
- 4-space indentation
- Single quotes
- Trailing commas
- Semicolons
- LF line endings

## Always

- Run `codestyle fix` before committing, not just `codestyle check`
- Never disable rules inline without a comment explaining why
- Sorting is enforced by perfectionist plugin — imports, types, object keys
