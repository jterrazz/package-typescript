# `lint/` — the manifest

One nature lives here: a DECISION about a lint rule. Never a config object, never a path, never a tool invocation — those are `src/presets/`'s and `bin/`'s. What the decisions mean, and the four laws they answer to, is [Lint presets](../docs/07-lint-presets.md); this page only says where each thing is.

| File                                                                               | Holds                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_contract.js`                                                                     | `fragment()`, `on()`, `typeAware()`, `off()`, `unsafeFix()`, `scoped()`, and the closed vocabularies `REASON_KINDS` and `AUDIENCES`                             |
| `compile.js`                                                                       | fragment → plain oxlint config, and the deterministic merge behind `compose()`. It never emits `categories`                                                     |
| `profiles.js`                                                                      | which fragments each of the six profiles carries, and what none of them lints                                                                                   |
| `catalog.js`                                                                       | every decision as one list, and the unsafe fixers `fix` refuses; the chapter's table is rendered by its test                                                    |
| `language/`                                                                        | one file per plugin of the rulebook every profile holds, whatever its framework: `eslint`, `typescript`, `unicorn`, `oxc`, `import`, `promise`, `node`, `jsdoc` |
| `react.js` · `a11y.js` · `next.js` · `react-native.js` · `astro.js` · `bundler.js` | what a framework profile adds to that rulebook, and what a bundled tree with no framework still owes                                                            |
| `vitest.js`                                                                        | the test-file rules, as an `overrides` block — they read a test and say nothing about anything else                                                             |
| `sorted.js`                                                                        | perfectionist: only what oxfmt does not sort                                                                                                                    |
| `architecture/`                                                                    | `layers.js` turns a declared layer map into `no-restricted-imports` overrides; `hexagonal.js` is the map this package ships                                     |

The builders enforce nothing: the invariants judge this package's fragments alone, so they are `self` rules, audited by this package's own suite over every fragment a module of `lint/` or `src/` exports, whether a profile carries it or not.

## What proves it

The suites that prove this folder are self rules, so they ship nowhere, and [Testing](../docs/03-testing.md#who-a-rule-is-for) names each one:

- the contract's suite — the invariants, audited over every fragment the package declares, and the compile of a fragment.
- the catalogue's suite — renders the chapter's projection of the manifest, and fails a chapter that has drifted from it.
- `specs/cli/preset/` — the resolved rule set, the plugin coverage, the fixpoint against the formatter, the behaviour of each decision, and the exclusive pairs.
