# Testing

A toolchain is proved by running it, so almost every test here drives the real `bin/typescript.sh` against a real project on disk.

```bash
npm test        # vitest — the unit tests and the specs
npm run lint    # this package's own CLI, run on this package
```

## Two suites, two speeds

`vitest.config.ts` declares two projects:

| Project | Runs                                                                      | Speed                        |
| ------- | ------------------------------------------------------------------------- | ---------------------------- |
| `fast`  | `src/**` and `rules/**` unit tests, plus the exports and declaration ones | milliseconds, pure functions |
| `e2e`   | everything else under `specs/` — the product command                      | seconds, real processes      |

The `fast` project is where a pure function is proved: `compose()`, the rulebook contract and its catalogue (`rules/*.test.ts`), the manual's rule engine over in-memory trees (`src/docs.test.ts`), and the two that read the package's own surface — `exports.test.ts` resolves every public subpath, `declarations.test.ts` holds each `.d.ts` to the value surface of the `.js` beside it. Nothing there spawns anything.

## A scenario is a document

`specs/cli/` drives the product command through `specification.cli(bin/typescript.sh)` — never a tool underneath it. Most scenarios are `<case>.spec.yaml` files rather than code:

```yaml
description: what the scenario claims # the vitest title
fixture: gitignore/old-layout/ # the ground it stands on
runs:
    - command: check # the session, one entry per invocation
      exit: 1
      stdout: |
          …
```

`literate({ specification })` from `@jterrazz/test/vitest` binds every document of this repo to `cli.specification.ts`, the product runner. The format itself is `@jterrazz/test`'s, and the regeneration gesture is below.

Each `check` document states the **whole** combined output of the run, not the fragment it is about. Where a fixture makes a tool refuse for a reason the scenario is not about — a knip case with no tsconfig, so tsc prints its own manual — the document spans that block with `{{any}}` and a comment naming whose noise it is.

One block is spanned for good: oxlint's own report. The linter picks its reporter from the environment — GitHub workflow commands under `GITHUB_ACTIONS`, one compact line per diagnostic under an AI agent, miette's framed rendering in a terminal — so its text is a fact about the machine, not about the run. No document states an oxlint diagnostic, and no suite parses one: the rulebook suites read `--format=json` through `diagnosticsOf`, and a `check` document claims the verdict our own passes print beneath the linter's block.

## The rulebook has seven suites

The presets are the one part of this package a document cannot reach: `check` loads a preset from the consumer's `node_modules`, and a copied fixture has none. So `specs/cli/preset/` drives the tools directly — the B9w exception `oxlint.specification.ts` states — and seven suites divide the claim between them.

| Suite             | Claims                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| `resolved-config` | each profile resolves to the rule set its golden records, marker by marker    |
| `rule-surface`    | every non-nursery rule of every loaded plugin is decided, and no `categories` |
| `fixpoint`        | oxlint's fixes and oxfmt's reach a fixed point — no rule fights the formatter |
| `behaviour`       | a fixture written to break rules reports exactly the diagnostics it should    |
| `exclusive-pairs` | every `off` of kind `exclusive` names a rule that really is on, and conflicts |
| `declarations`    | every `.d.ts` carries the value surface of the `.js` beside it                |
| `install-matrix`  | one consumer per profile installs under pnpm-strict and checks green          |

The last one is the outside view, and it is the one that fails when the corpus is wrong: seven tiny projects, each the smallest honest consumer — a manifest, a tsconfig extending that profile's preset, the two config files written as [Developing](02-developing.md) writes them, one source file and one test file. The ground is `specs/cli/preset/_fixtures/install-matrix/<profile>/`, and the profile IS the directory name, so an eighth profile earns a consumer by existing. The two config files are the one thing the ground does NOT carry: the runner writes them, for the same reason as above, and that heredoc is the single place the documented form is stated for all seven.

### Regenerating a golden

Every golden of this repository takes the same gesture:

```bash
TEST_UPDATE=1 npm test
```

It rewrites the `_expected/` trees, the resolved-config rosters, the catalogue section of [Lint presets](07-lint-presets.md), and the `stdout` of every spec document. Two things about it are worth knowing before reaching for it. A `{{any}}` token SURVIVES, but the real output is appended after it — so a document spanning a block it is not about is hand-edited, never regenerated. And the catalogue table comes out unaligned; `typescript fix` puts the columns back, and the freshness test compares cells, not padding.

## When a `.test.ts` is the right answer

A chain of code is the exception, and each one says which exception it is:

- **The binary is not the product.** oxfmt and oxlint run directly in the rulebook suites, and three install sandboxes run a shell script — the split install, the pnpm-strict one that proves a consumer's configs load with one devDependency declared, and the profile matrix above.
- **The stream has no byte-exact form.** `dev/` waits on a marker instead.
- **The ground cannot be a fixture.** A fixture is copied, not initialised, so a scenario needing a real git repository builds one in a temp directory: the committed-artefact claim, and the Docs (layout) pass, which asks its question only where a repository is. A project whose `oxlint.config.*` cannot LOAD, or whose config ARMS a rule at `error` over its own deliberately broken tree, is the same case for a different reason — oxlint reads every config under this repository, fixtures included, so either one committed here would fail this repository's own lint run ([Quality checks](06-quality-checks.md)).
- **The cwd must sit below the ground.** The gitignore gate's ancestor walk needs a `.gitignore` ABOVE the working directory, and `fixture:` spreads a project INTO it.
- **The document cannot make the claim.** Two are bridges: `cli.run('<case>.spec.yaml')` runs the document, then code adds a byte-exact directory golden or an exhaustive file list. A bridged document is excluded from the plugin's glob in `vitest.config.ts`, so it runs once.

## Where a fixture lives

What a spec stands on carries a leading underscore. The shared pool is `specs/_fixtures/`, reached as `fixture: $FIXTURES/…`, and it holds only what SEVERAL domains use — `sample-app`, `sample-documented`, `incremental-app`. A fixture one domain alone reaches for lives beside that domain, in `specs/cli/<domain>/_fixtures/`, and is named by its relative form. Goldens are `_expected/`.

The domains today: `build`, `check` (the passes, each stating the whole run), `clean`, `dev`, `docs` (the compiler, plus two bridges), `docs-layout` (the manual's rules, one document per family), `doctor`, `help`, `preset`, `start`.

## The self-lint is the strongest test

`npm run lint` is `typescript check` run on this repository, so the package is the first consumer of every gate it ships:

- the **Docs (sync)** pass regenerates this repo's own `docs/reference/` and diffs it — so a corpus or public-API change that forgets `./bin/typescript.sh docs` fails here first;
- the **Docs (layout)** pass reads this repo's own `docs/`, which is why the chapters you are reading carry the spine the rule demands;
- `oxlint.config.ts` loads the `@jterrazz/test` ESM plugin through the exports map, and `check` type-checks `specs/` plus `src/index.d.ts` — a broken exports map fails the lint, not a consumer.

A change that passes `npm test` but not `npm run lint` is not finished.

## Related

- [Developing](02-developing.md) — the gestures, and where a new file goes.
- [Quality checks](06-quality-checks.md) — what each gate refuses.
- [Docs pipeline](08-docs-pipeline.md) — the projection the sync pass guards.
