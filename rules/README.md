# `rules/` — the manifest

One nature lives here: a DECISION about a lint rule. Never a config object, never a path, never a tool invocation — those are `presets/`'s and `bin/`'s. What the decisions mean, and the four laws they answer to, is [Lint presets](../docs/07-lint-presets.md); this page only says where each thing is.

| File                                                                               | Holds                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_contract.js`                                                                     | `fragment()`, `on()`, `typeAware()`, `off()`, `scoped()` — and the load-time refusal of a level that is not `error`/`off` and of an `off` with no reason |
| `compile.js`                                                                       | fragment → plain oxlint config, and the deterministic merge behind `compose()`. It never emits `categories`                                              |
| `profiles.js`                                                                      | which fragments each of the seven profiles carries, and what none of them lints                                                                          |
| `catalog.js`                                                                       | every decision as one list, and the markdown the chapter carries between its `GENERATED` markers                                                         |
| `core/`                                                                            | one file per plugin of the rulebook every profile holds: `eslint`, `typescript`, `unicorn`, `oxc`, `import`, `promise`, `node`, `jsdoc`                  |
| `react.js` · `a11y.js` · `next.js` · `react-native.js` · `astro.js` · `bundler.js` | what a framework profile adds to that rulebook, and what a bundled tree with no framework still owes                                                     |
| `vitest.js`                                                                        | the test-file rules, as an `overrides` block — they read a test and say nothing about anything else                                                      |
| `sorted.js`                                                                        | perfectionist: only what oxfmt does not sort                                                                                                             |
| `architecture/`                                                                    | `layers.js` turns a declared layer map into `no-restricted-imports` overrides; `hexagonal.js` is the map this package ships                              |

A fragment is loaded, not read: importing one runs its contract, so a decision that breaks an invariant fails at import time rather than at review time.

## What proves it

- `_contract.test.ts` — the invariants, and the compile of a fragment.
- `catalog.test.ts` — the chapter is the manifest's projection, and nothing else.
- `specs/cli/preset/` — the resolved rule set, the plugin coverage, the fixpoint against the formatter, the behaviour of each decision, and the exclusive pairs.
