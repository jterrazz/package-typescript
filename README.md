# @jterrazz/codestyle

Fast, opinionated linting and formatting for TypeScript. Powered by Oxlint, Oxfmt, tsgo, and Knip.

## Quick Start

```bash
npm install @jterrazz/codestyle --save-dev
```

Create `.oxlintrc.json`:

```json
{
  "extends": ["node_modules/@jterrazz/codestyle/presets/oxlint/node.json"]
}
```

Run:

```bash
npx codestyle check   # Check everything (types + lint + format + unused code)
npx codestyle fix     # Fix lint and formatting issues
```

## Presets

Pick a base config:

| Preset                                                      | Use Case                          |
| ----------------------------------------------------------- | --------------------------------- |
| `node_modules/@jterrazz/codestyle/presets/oxlint/node.json` | Node.js (requires .js extensions) |
| `node_modules/@jterrazz/codestyle/presets/oxlint/expo.json` | Expo / React Native               |
| `node_modules/@jterrazz/codestyle/presets/oxlint/next.json` | Next.js                           |

Architecture preset (additive):

| Preset                                                                         | Use Case                           |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| `node_modules/@jterrazz/codestyle/presets/oxlint/architectures/hexagonal.json` | Hexagonal architecture enforcement |

## Architecture Enforcement

Enforce hexagonal architecture boundaries:

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

## Unused Code Detection

`codestyle check` runs [Knip](https://knip.dev/) to detect unused files, exports, and dependencies. Knip auto-detects your framework from `package.json` (Next.js, Vitest, Prisma, etc.) with 100+ built-in plugins.

For fine-tuning, create a `knip.json`:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignoreDependencies": ["@jterrazz/codestyle", "@jterrazz/test", "@jterrazz/typescript"],
  "ignoreBinaries": ["oxlint", "oxfmt"]
}
```

Knip only runs in `check` mode (not `fix`) since its auto-fix removes exports and files.

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
