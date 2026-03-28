---
name: jterrazz-codestyle
description: Linting, formatting, and type-checking for TypeScript projects using @jterrazz/codestyle. Activates when configuring linting rules, fixing code style issues, setting up oxlint/oxfmt, or enforcing architecture boundaries.
---

# @jterrazz/codestyle

Opinionated linting + formatting + type checking. Runs tsgo, oxlint, and oxfmt in parallel.

## Commands

```bash
codestyle check   # Check everything — types + lint + format
codestyle fix     # Auto-fix lint and formatting issues
```

## Setup

```bash
npm install @jterrazz/codestyle
```

**`.oxlintrc.json`** — pick a preset:

```json
{ "extends": ["node_modules/@jterrazz/codestyle/presets/oxlint/node.json"] }
{ "extends": ["node_modules/@jterrazz/codestyle/presets/oxlint/next.json"] }
{ "extends": ["node_modules/@jterrazz/codestyle/presets/oxlint/expo.json"] }
```

**package.json scripts:**

```json
{
  "lint": "codestyle check",
  "lint:fix": "codestyle fix"
}
```

## Presets

| Preset                                                      | Use case                         |
| ----------------------------------------------------------- | -------------------------------- |
| `node_modules/@jterrazz/codestyle/presets/oxlint/node.json` | Node.js — requires `.js` imports |
| `node_modules/@jterrazz/codestyle/presets/oxlint/next.json` | Next.js                          |
| `node_modules/@jterrazz/codestyle/presets/oxlint/expo.json` | Expo / React Native              |

## Architecture enforcement (optional)

Add hexagonal architecture boundary rules:

```json
{
  "extends": [
    "node_modules/@jterrazz/codestyle/presets/oxlint/node.json",
    "node_modules/@jterrazz/codestyle/presets/oxlint/architectures/hexagonal.json"
  ]
}
```

Rules enforced:

- `domain/` cannot import from other layers
- `application/` cannot import infrastructure
- `presentation/ui/` cannot import navigation
- `features/` cannot import other features

## What runs

| Tool   | Purpose       | Language |
| ------ | ------------- | -------- |
| tsgo   | Type checking | Go       |
| oxlint | Linting       | Rust     |
| oxfmt  | Formatting    | Rust     |

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
