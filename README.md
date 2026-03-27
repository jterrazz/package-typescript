# @jterrazz/codestyle

Fast, opinionated linting and formatting for TypeScript. Powered by Oxlint, Oxfmt, and tsgo.

## Quick Start

```bash
npm install @jterrazz/codestyle --save-dev
```

Create `.oxlintrc.json`:

```json
{
  "extends": ["@jterrazz/codestyle/oxlint/node"]
}
```

Run:

```bash
npx codestyle check   # Check everything (types + lint + format)
npx codestyle fix     # Fix everything
```

## Configurations

Pick a base config:

| Config                            | Use Case                          |
| --------------------------------- | --------------------------------- |
| `@jterrazz/codestyle/oxlint/node` | Node.js (requires .js extensions) |
| `@jterrazz/codestyle/oxlint/expo` | Expo / React Native               |
| `@jterrazz/codestyle/oxlint/next` | Next.js                           |

Architecture plugin (additive):

| Plugin                                               | Use Case                           |
| ---------------------------------------------------- | ---------------------------------- |
| `@jterrazz/codestyle/oxlint/architectures/hexagonal` | Hexagonal architecture enforcement |

## Architecture Enforcement

Enforce hexagonal architecture boundaries:

```json
{
  "extends": [
    "@jterrazz/codestyle/oxlint/node",
    "@jterrazz/codestyle/oxlint/architectures/hexagonal"
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
