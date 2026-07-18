# Lint presets

The `@jterrazz/typescript/oxlint` entry ships named presets plus a `compose(...)` merger — projects wire the fragments they want, explicitly.

There is no dependency auto-detection in the presets: what you compose is what runs.

## Presets

| Preset             | Use case                          |
| ------------------ | --------------------------------- |
| `oxlint.node`      | Node.js — requires `.js` imports  |
| `oxlint.next`      | Next.js                           |
| `oxlint.expo`      | Expo / React Native               |
| `oxlint.hexagonal` | Hexagonal architecture (additive) |

## Composing fragments

`compose(...fragments)` merges deterministically: `jsPlugins` / `plugins` / `ignorePatterns` / `extends` concatenated and deduped, `rules` / `categories` shallow-merged (last wins), `overrides` concatenated. Compose an extra fragment last to deviate on a single rule.

A project using `@jterrazz/test` composes its testing fragment explicitly:

```ts
import { testing } from '@jterrazz/test/oxlint';
import { compose, node } from '@jterrazz/typescript/oxlint';

export default compose(node, testing);
```

## Architecture enforcement

The additive `hexagonal` preset enforces layer boundaries:

```ts
import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({ extends: [oxlint.node, oxlint.hexagonal] });
```

Rules enforced:

- `domain/` cannot import from other layers.
- `application/` cannot import infrastructure.
- `presentation/ui/` cannot import navigation.
- `features/` cannot import other features.

## Unused code (knip)

`typescript check` runs [Knip](https://knip.dev/) with a base config auto-merged with any project-local `knip.json`:

- `@jterrazz/*` packages auto-ignored.
- Published libraries: `exports` / `types` / `files` rules auto-disabled.
- Convention paths (`fixtures/`, `expected/`, `docs/`) auto-ignored.
- Plugin dependencies (`*-plugin-*`, `@scope/*`) auto-ignored.

Create a `knip.json` only for project-specific overrides.

## Formatting rules (oxfmt)

100-char print width, 4-space indentation, single quotes, trailing commas, semicolons, LF line endings.

## Related

- [Quality checks](03-quality-checks.md) — how the presets are run.
