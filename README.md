# @jterrazz/codestyle

Fast, opinionated linting and formatting for TypeScript. Powered by Oxlint, Oxfmt, and tsgo.

## Quick Start

```bash
npm install @jterrazz/codestyle --save-dev
```

Create `.oxlintrc.json`:

```json
{
  "extends": ["@jterrazz/codestyle/presets/oxlint/node.json"]
}
```

Run:

```bash
npx codestyle check   # Check everything (types + lint + format)
npx codestyle fix     # Fix everything
```

## Presets

Pick a base config:

| Preset                                         | Use Case                          |
| ---------------------------------------------- | --------------------------------- |
| `@jterrazz/codestyle/presets/oxlint/node.json` | Node.js (requires .js extensions) |
| `@jterrazz/codestyle/presets/oxlint/expo.json` | Expo / React Native               |
| `@jterrazz/codestyle/presets/oxlint/next.json` | Next.js                           |

Architecture preset (additive):

| Preset                                                            | Use Case                           |
| ----------------------------------------------------------------- | ---------------------------------- |
| `@jterrazz/codestyle/presets/oxlint/architectures/hexagonal.json` | Hexagonal architecture enforcement |

## Architecture Enforcement

Enforce hexagonal architecture boundaries:

```json
{
  "extends": [
    "@jterrazz/codestyle/presets/oxlint/node.json",
    "@jterrazz/codestyle/presets/oxlint/architectures/hexagonal.json"
  ]
}
```

Rules enforced:

- `domain/` cannot import from other layers
- `application/` cannot import infrastructure
- `presentation/ui/` cannot import navigation
- `features/` cannot import other features

## What runs

`codestyle` runs three tools in parallel:

| Tool   | Purpose       |
| ------ | ------------- |
| tsgo   | Type checking |
| oxlint | Linting       |
| oxfmt  | Formatting    |
