# @jterrazz/codestyle

Fast, opinionated linting and formatting for TypeScript. Powered by Oxlint (2-3x faster than ESLint) and Oxfmt.

## Quick Start

```bash
npm install @jterrazz/codestyle --save-dev
```

Create `.oxlintrc.json`:

```json
{
  "extends": ["node_modules/@jterrazz/codestyle/src/oxlint/node.json"]
}
```

> **Note:** The `node_modules/` path is required because oxlint doesn't support npm module resolution in `extends`.

Run:

```bash
npx codestyle          # Check everything
npx codestyle --fix    # Fix everything
```

## Configurations

Base configurations (pick one):

| Config                                                    | Use Case                          |
| --------------------------------------------------------- | --------------------------------- |
| `node_modules/@jterrazz/codestyle/src/oxlint/node.json`   | Node.js (requires .js extensions) |
| `node_modules/@jterrazz/codestyle/src/oxlint/expo.json`   | Expo / React Native               |
| `node_modules/@jterrazz/codestyle/src/oxlint/nextjs.json` | Next.js                           |

Architecture plugins (additive, combine with any base config):

| Plugin                                                                     | Use Case                           |
| -------------------------------------------------------------------------- | ---------------------------------- |
| `node_modules/@jterrazz/codestyle/src/oxlint/architectures/hexagonal.json` | Hexagonal architecture enforcement |

## CLI

```bash
npx codestyle              # Run all checks (type + lint + format)
npx codestyle --fix        # Auto-fix all issues

npx codestyle --type       # TypeScript only
npx codestyle --lint       # Lint only
npx codestyle --format     # Format only
```

## Architecture Enforcement (Optional)

Enforce hexagonal architecture boundaries:

```json
{
  "extends": [
    "node_modules/@jterrazz/codestyle/src/oxlint/node.json",
    "node_modules/@jterrazz/codestyle/src/oxlint/architectures/hexagonal.json"
  ]
}
```

Rules enforced:

- `domain/` cannot import from other layers
- `application/` cannot import infrastructure
- `presentation/ui/` cannot import navigation
- `features/` cannot import other features


