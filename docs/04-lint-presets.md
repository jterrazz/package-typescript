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

Asset trees are ignored by default: `next` skips `public/**` and `assets/**` (the stack's convention for content trees — signed bytes can live there), `expo` skips `.expo/**` and its scaffolded `assets/**`. Neither is source; a consumer with source in those paths is fighting the convention, not the preset.

The base preset keeps `import/exports-last` off — exports-at-end fights how files read across the whole ecosystem, and three repos had rediscovered the same exception before it moved here. The `next` preset additionally relaxes what fights the framework's idiom: `oxc/no-map-spread` (immutable serialization maps) and `unicorn/prefer-global-this` (client components mean `window`).

## The `style` category

The base preset turns oxlint's whole `style` category on (`categories: { style: 'error' }`), so its rules shape the code before any reviewer does. Two of them are the ones a consumer meets first, and neither is obvious from the error message alone.

### `one-var` — one `const` statement per scope

Declarations of the same kind in one scope are a single statement, comma-chained. A second `const` after a first is `Combine this with the previous 'const' statement`:

```ts
const RETRY_LIMIT = 3,
    TIMEOUT_MS = 10_000;
```

The shape it drives through a whole module: the private constants first, chained into one `const`, then the exported `function` declarations.

`typescript fix` repairs a violation by **fusing** the statements — and that is the hazard. A comment standing between the two is swallowed into the chain, where it now sits between two declarators:

```ts
// Before fix — two statements, a comment on its own line between them
const alpha = 1;
// A note about beta
const beta = 2;

// After fix — one chain, and the note has been pulled inside it
const alpha = 1,
    // A note about beta
    beta = 2;
```

So a comment that must stay a line of its own goes between STATEMENTS, never between two declarations the fixer is about to weld together. It bites hardest on the `// Given -` / `// Then -` narration `@jterrazz/test` requires in every test: a marker parked between two `const` lines is silently relocated into a declaration chain and stops separating anything.

### `unicorn/max-nested-calls` — three levels of nesting at most

A call nested four deep is `Call is nested too deeply. Maximum allowed is 3`, reported on the innermost one. Schema declarations are where it lands: three levels pass, the fourth does not.

```ts
// Passes — three levels
const ITEMS = z.looseObject({ items: z.array(z.string()) });

// Refused — z.string() is the fourth
const ORDER = z.looseObject({ items: z.array(z.looseObject({ id: z.string() })) });
```

The fix is not a deviation but a named builder function whose locals name the levels; the module constant holds its result:

```ts
function buildOrderSchema() {
    const item = z.looseObject({ id: z.string() });

    return z.looseObject({ items: z.array(item) });
}

const ORDER_SCHEMA = buildOrderSchema();
```

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
- Convention paths (`fixtures/`, `expected/`, `docs/`) auto-ignored — at the root and inside every workspace member, because the convention belongs to the package.
- Plugin dependencies (`*-plugin-*`, `@scope/*`) auto-ignored.

Create a `knip.json` only for project-specific overrides.

### Workspaces

Knip is workspace-aware on its own: it reads the `workspaces` globs from your `package.json` and reports per member from a single run — which is why `check` invokes it once, at the root. Per-member settings go under a `workspaces` key in your `knip.json`:

```json
{
    "workspaces": {
        "apps/api": { "ignoreDependencies": ["some-local-dep"] }
    }
}
```

The base preset declares no `workspaces`, so the key reaches knip exactly as written.

## Formatting rules (oxfmt)

100-char print width, 4-space indentation, single quotes, trailing commas, semicolons, LF line endings.

## Related

- [Quality checks](03-quality-checks.md) — how the presets are run.
