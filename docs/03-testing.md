# Testing

A toolchain is proved by running it, so almost every test here drives the real `bin/typescript.sh` against a real project on disk.

```bash
npm test        # vitest — the unit tests and the specs
npm run lint    # this package's own CLI, run on this package
```

## Two suites, two speeds

`vitest.config.ts` declares two projects:

| Project | Runs                                               | Speed                        |
| ------- | -------------------------------------------------- | ---------------------------- |
| `fast`  | `src/**/*.test.ts` and the exports resolution test | milliseconds, pure functions |
| `e2e`   | everything under `specs/` — the product command    | seconds, real processes      |

The `fast` project is where a pure function is proved: `compose()`, and the manual's rule engine over in-memory trees (`src/docs.test.ts`). Nothing there spawns anything.

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

`literate({ specification })` from `@jterrazz/test/vitest` binds every document of this repo to `cli.specification.ts`, the product runner. Regenerate the streams with `TEST_UPDATE=1`; the `{{duration}}`-style tokens survive it. The format itself is `@jterrazz/test`'s.

Each `check` document states the **whole** combined output of the run, not the fragment it is about. Where a fixture makes a tool refuse for a reason the scenario is not about — a knip case with no tsconfig, so tsc prints its own manual — the document spans that block with `{{any}}` and a comment naming whose noise it is.

## When a `.test.ts` is the right answer

A chain of code is the exception, and each one says which exception it is:

- **The binary is not the product.** oxfmt and oxlint run directly in three of them, and two install sandboxes run a shell script — the split install, and the pnpm-strict one that proves a consumer's configs load with one devDependency declared.
- **The stream has no byte-exact form.** `dev/` waits on a marker instead.
- **The ground cannot be a fixture.** A fixture is copied, not initialised, so a scenario needing a real git repository builds one in a temp directory: the committed-artefact claim, and the Docs (layout) pass, which asks its question only where a repository is.
- **The cwd must sit below the ground.** The gitignore gate's ancestor walk needs a `.gitignore` ABOVE the working directory, and `fixture:` spreads a project INTO it.
- **The document cannot make the claim.** Two are bridges: `cli.run('<case>.spec.yaml')` runs the document, then code adds a byte-exact directory golden or an exhaustive file list. A bridged document is excluded from the plugin's glob in `vitest.config.ts`, so it runs once.

## Where a fixture lives

What a spec stands on carries a leading underscore. The shared pool is `specs/_fixtures/`, reached as `fixture: $FIXTURES/…`, and it holds only what SEVERAL domains use — `sample-app`, `sample-documented`, `incremental-app`. A fixture one domain alone reaches for lives beside that domain, in `specs/cli/<domain>/_fixtures/`, and is named by its relative form. Goldens are `_expected/`.

The domains today: `build`, `check` (the passes, each stating the whole run), `clean`, `dev`, `docs` (the compiler, plus two bridges), `docs-layout` (the manual's rules, one document per family), `help`, `preset`, `start`.

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
