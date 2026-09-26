# Testing

A toolchain is proved by running it, so almost every test here drives the real `bin/typescript.sh` against a real project on disk.

```bash
npm test        # vitest — the unit tests and the specs
npm run lint    # this package's own CLI, run on this package
```

## Two suites, two speeds

`vitest.config.ts` declares two projects, through `@jterrazz/test/vitest`'s own project helpers — `unit()` and `cli()`:

| Project | Runs                                                | Speed                                                                                      |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `unit`  | `src/`, `lint/` and `specs/surface/`                | milliseconds for pure functions; seconds where a module's script is run as `check` runs it |
| `cli`   | everything under `specs/cli/` — the product command | seconds, real processes                                                                    |

A `cli` test has a budget of its own: `TOOLCHAIN_BUDGET_MS`, 120 s, in `vitest.config.ts`, where the preset gives every other test 30 s. What that project runs is the whole toolchain — the compiler, the type-aware linter, knip and every tree gate — once or twice per test, beside every other file of the project running at the same time. Its duration is therefore a fact about the machine's load more than about the run, and a budget cut to an idle machine fails a correct test on a busy one; 120 s holds two runs on a loaded machine, and a run that hangs still fails.

The suffix says which project a file belongs to. A `*.test.ts` is a module test and sits beside its module, which here is `src/` and `lint/`, or is a meta-test of this package's own and sits under `lint/self/corpus/`; a `*.spec.ts` is the assembled product and sits under `specs/<facet>/`. `unit()` collects the first, `cli()` the second plus every `<case>.spec.yaml`, and the `cli` project states nothing of its own. `unit()` is the one that states its globs, because one tree it collects lives under `specs/` and the default set excludes that folder whole.

The `unit` project is where a pure function is proved: `compose()`, the rulebook's builders (`lint/engine/compiler/decision.test.ts`), and the manual's rules over in-memory trees (`lint/consumer/checks/docs.test.ts`). Nothing there spawns anything but `make`, over stubs, where the `fix` recipe is proved; `npm pack` and `tar`, where the tarball is read as a consumer receives it and its bin is run once over an empty folder (`specs/surface/package/tarball.test.ts`), and `npm pack --dry-run`, where a self rule's home is held out of it (`lint/self/corpus/audience.test.ts`); `git`, where the sweep every tree gate starts from reads a repository's index (`lint/engine/project/project-files.test.ts`); and `node`, where the baseline judge and the drift report are run as `check` runs them, over a project written to a temporary root (`lint/engine/checker/baseline.test.ts`, `lint/consumer/checks/drift.test.ts`) — the drift report's linter is the one installed here, asked for a resolved config and nothing else, and one case wraps it in a `bash` script that counts its `--print-config` calls.

### `specs/surface/` — the repository suite

The files under `specs/surface/package/` read this package's own published tree rather than one module: `exports.test.ts` resolves every public subpath, `declarations.test.ts` holds each `.d.ts` to the value surface of the `.js` beside it, `tarball.test.ts` and `builder-calls.test.ts` hold the split between the rules that ship and the rules that stay home over the packed tree they share with `shipped-links.test.ts`, `packed-tree.ts` ([below](#who-a-rule-is-for)), and `makefile.test.ts` runs the `fix` recipe [Quality checks](06-quality-checks.md#the-six-gestures) hands consumers — and this repository's own — over stubbed fixers. None has a module to sit beside — each reads the whole package — and none reaches a runner, since nothing is served.

That shape is the THIRD DOOR the conventions name: a first-level folder under `specs/` that is no facet, covering a tree instead of a product served through an entry. `facet-test-uses-its-runner` and `facet-folder-has-specification` do not reach it, its files carry the unit's `.test.ts`, and `unit()` collects them by glob. `specs-at-declared-depth` still judges the shape, at the depth this project declares — the default — so the asset-less files group in a domain folder, `package/`, exactly as they would under a facet. The constitution owns the rule — `@jterrazz/test`'s `docs/18-conventions.md`, "The third door: a repository suite".

## A scenario is a document

`specs/cli/` drives the product command through `specification.cli(bin/typescript.sh)` — never a tool underneath it. Most scenarios are `<case>.spec.yaml` files rather than code:

```yaml
description: what the scenario claims # the vitest title
fixture: ./_fixtures/gitignore/old-layout/ # the ground it stands on, by its path
runs:
    - command: check # the session, one entry per invocation
      exit: 1
      stdout: |
          …
```

`literate({ specification })` from `@jterrazz/test/vitest` binds every document of this repo to `cli.specification.ts`, the product runner. The format itself is `@jterrazz/test`'s, and the regeneration gesture is below.

Each `check` document states the **whole** combined output of the run, not the fragment it is about. Where a fixture makes a tool refuse for a reason the scenario is not about — a knip case with no tsconfig, so tsc prints its own manual — the document spans that block with `{{any}}` and a comment naming whose noise it is.

One block is spanned for good: oxlint's own report. The linter picks its form from the environment — GitHub workflow commands under `GITHUB_ACTIONS`, one compact line per diagnostic under an AI agent, miette's framed rendering elsewhere — and `check` prints the report in the form the linter picks, so its text is a fact about the machine, not about the run. No document states an oxlint diagnostic: the rulebook suites read `--format=json` through `diagnosticsOf`, and a `check` document claims the verdict our own passes print beneath the linter's block. What the block holds is proved once, by `specs/cli/check/oxlint-report.spec.ts`, against oxlint itself: in each form, over a file breaking a rule of every frame shape, the pass prints what oxlint prints alone.

## The rulebook has seven suites

The presets are the one part of this package a document cannot reach: `check` loads a preset from the consumer's `node_modules`, and a copied fixture has none. So `specs/cli/preset/` drives the tools directly — the `cli-runs-the-product-binary` exception `oxlint.specification.ts` states — and seven suites divide the claim about what the rulebook decides between them. The folder's other suites — `composition`, `covered-by-testing`, `resolution`, `strict-install`, `tsconfig` — prove how a preset composes, resolves and loads, not what it decides.

| Suite                 | Claims                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolved-config`     | each profile resolves to the rule set its golden records, marker by marker                                                                                      |
| `rule-surface`        | every non-nursery rule of every loaded plugin is decided, every type-aware one too, and no `categories`; an `unsafe` mark sits on a fixer plain `--fix` applies |
| `fixpoint`            | oxlint's fixes and oxfmt's reach a fixed point — no rule fights the formatter                                                                                   |
| `behaviour`           | a fixture written to break rules reports exactly the diagnostics it should                                                                                      |
| `exclusive-pairs`     | every `off` of kind `exclusive` names a rule that really is on, and conflicts                                                                                   |
| `install-matrix`      | one consumer per profile installs under pnpm-strict and checks green                                                                                            |
| `module-augmentation` | a `declare module` block keeps the interface that merges, and its `export {}`                                                                                   |

The `install-matrix` suite is the outside view, and it is the one that fails when the corpus is wrong: seven tiny projects, each the smallest honest consumer — a manifest, a tsconfig extending that profile's preset, the two config files written as [Developing](02-developing.md) writes them, one source file and one test file. The ground is `specs/cli/preset/_fixtures/install-matrix/<profile>/`, and the profile IS the directory name, so an eighth profile earns a consumer by existing. The two config files are the one thing the ground does NOT carry: the runner writes them, for the same reason as above, and that heredoc is the single place the documented form is stated for all seven.

The `astro` consumer declares `astro`, because the preset it extends stands on Astro's own. What the runner links there is a stand-in, `specs/cli/preset/_fixtures/astro-package/` — Astro's strict tsconfig and a CLI whose `check` has no template to refuse — at the consumer's root, and again beside the package in the sandbox's store, which sits outside the consumer where pnpm's would sit inside it.

### Regenerating a golden

Every golden of this repository takes the same gesture:

```bash
TEST_UPDATE=1 npm test
```

It rewrites the `_expected/` trees, the resolved-config rosters, the catalogue section of [Lint presets](07-lint-presets.md), and the `stdout` of every spec document. Two things about it are worth knowing before reaching for it. A `{{any}}` token SURVIVES, but the real output is appended after it — so a document spanning a block it is not about is hand-edited, never regenerated. And the catalogue table comes out unaligned; `typescript fix` puts the columns back, and the freshness test compares cells, not padding.

## When a chain of code is the right answer

Under `specs/cli/` every spec is a `.spec.ts` whatever door it takes — the suffix says the assembled product, not which runner reaches it. A document is still the default, and a chain of code is the exception; each one says which exception it is:

- **The binary is not the product.** oxfmt and oxlint run directly in the rulebook suites, and three install sandboxes run a shell script — the split install, the pnpm-strict one that proves a consumer's configs load with one devDependency declared, and the profile matrix above.
- **The stream has no byte-exact form.** `dev/` waits on a marker instead.
- **The ground cannot be a fixture.** A fixture is copied, not initialised, so a scenario needing a real git repository builds one in a temp directory: the committed-artefact claim, and the Docs (layout) pass, which asks its question only where a repository is. A stub installed under `node_modules/` is the same case, since git never tracks that folder: the ratchet-ownership claim copies its fixture into a temp directory and installs the stub checker beside it, and the build guard's claims link this checkout's `@jterrazz/test` beside theirs, since the guard judges only by the install the package resolves. A config oxlint would refuse as a NESTED one is the same case for a different reason. `typescript check` hands oxlint files and never reads a config under the ground ([Quality checks](06-quality-checks.md)), but `@jterrazz/test`'s checker, run alone as `make fix` runs it first, hands oxlint this repository whole, and oxlint loads every config in it: one that cannot load, one naming a root-only `options` key, or one registering a plugin name this repository's config already holds would fail that run. A config that only ARMS rules over a deliberately broken tree is safe to commit, since the linter is handed no file of the ground it sits in, and a case needing a root-only option runs the default profile, which ships them.
- **The cwd must sit below the ground.** The gitignore gate's ancestor walk needs a `.gitignore` ABOVE the working directory, and so does the claim that a config above a project with none of its own is never read; `fixture:` spreads a project INTO the working directory.

The first three exceptions reach no `cli` chain at all, which is what `facet-test-uses-its-runner` refuses: a spec under a facet folder is expected to import that facet's runner. They are recorded in the `test` section of `jterrazz.baseline.json`, whose entry for that pass is their count — `@jterrazz/test`'s own ratchet, since the rule is that package's — for that reason, and the shape that pays the debt is now named rather than open — the third door, the same one `specs/surface/` took: the rulebook suites become a first-level suite of their own, in one move, rather than being rewritten one by one.

## Where a fixture lives

What a spec stands on sits in the four ground folders `@jterrazz/test` reserves wherever a test stands on a file: `_fixtures/`, `_expected/`, `_seeds/` and `_requests/`. The shared pool is `specs/_shared/_fixtures/`, and it holds only what SEVERAL domains use — `sample-app`, `incremental-app`. A fixture one domain alone reaches for lives beside that domain, in `specs/cli/<domain>/_fixtures/`. Either way a spec names it by its path from the spec file, spelled in full, and a string is never a path: a chain hands the disk over as `file()` or `directory()` — `.fixture(file('./_fixtures/formatter/wrong-style.ts'))`, `.fixture(directory('../../_shared/_fixtures/sample-app/'))` — and a golden the same way, `toMatch(file('./_expected/resolution.txt'))`. A document's `fixture:` takes the same paths, its trailing `/` saying which of the two it is: `fixture: ./_fixtures/sample-lib/` spreads a directory. A stream compared as a value reads `result.stdout.text`.

The presets this repository ships ignore those four folders wherever they sit, and its own run takes them from the presets like any consumer: no ignore of its own in the lint scripts, `oxfmt.config.ts`, `knip.json` or `tsconfig.json`.

The domains today: `build`, `check` (the passes, each stating the whole run), `clean`, `dev`, `docs-layout` (the manual's rules, one document per family), `doctor`, `help`, `preset`, `start`.

## Who a rule is for

Every rule this package holds declares its audience: `consumer`, meaningful in any project that uses the package, or `self`, this package's own suite discipline. Only consumer rules ship. A self rule lives in this repository's tests and its own configs, and this chapter is where it is described: the catalogue in [Lint presets](07-lint-presets.md) lists consumer rules alone, and `files` leaves this chapter out of the package, since describing a self rule names it.

### Where each rule declares it

A rulebook fragment declares `audience` for every decision it holds, from the closed pair `AUDIENCES` in `lint/engine/compiler/decision.js`, and each catalogue entry carries it. Every other rule is a row of the manifest — `lint/consumer/catalogue/manifest.json` for a consumer row, `lint/self/catalogue/manifest.json` for a self one — on one of three channels: `checker`, a pass of `typescript check`; `runtime`, a refusal a shipped module or script throws, rejects or exits non-zero with; and `meta`, a meta-test. The package holds no type-level rule. A `self` row names its `home`, the path that holds it, and the `names` it goes by.

Every fragment, every pass and every refusal that ships is `consumer` today. The runtime rows that throw are `layers()` refusing a map with no id, and a map whose layers share a glob, and the sweep refusing a tree it cannot read. The rest exit: each executable of `lint/` and `src/cli/` and each script of `bin/` failing its verdict, its usage or a read it cannot make, one row per exit that is not 0.

### The self rules

<!-- GENERATED:self -->

| Id                     | Channel   | Home                                          | Why it stays self                                                                                                            |
| ---------------------- | --------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pass-selector`        | `checker` | `specs/cli/check-selection.sh`                | runs only the passes a spec asserts on, from a copy of the check no install holds; no consumer project needs a partial check |
| `decision-invariants`  | `meta`    | `lint/self/corpus/decision-invariants.ts`     | judges this package's own fragments; fragment() is not exported                                                              |
| `catalogue-projection` | `meta`    | `lint/self/corpus/chapter-projections.ts`     | renders and holds fresh this repository's own chapter                                                                        |
| `audience-audit`       | `meta`    | `lint/self/corpus/audience.ts`                | reads this package's own manifest                                                                                            |
| `tarball-audit`        | `meta`    | `specs/surface/package/tarball.test.ts`       | reads what this package would publish                                                                                        |
| `builder-call-audit`   | `meta`    | `specs/surface/package/builder-calls.test.ts` | reads the text of every module this package would publish, for a fragment() call whose audience is not a literal             |
| `shipped-links`        | `meta`    | `specs/surface/package/shipped-links.test.ts` | reads what this package would publish against this checkout                                                                  |
| `findings-audit`       | `meta`    | `lint/self/corpus/findings.ts`                | reads this package's own passes against its own catalogue                                                                    |

<!-- /GENERATED:self -->

A decision's two invariants — a level is `error` or `off`, and an `off` carries one of the five reasons naming what carries it, as an unsafe fixer names what its rewrite changes — judge this package's fragments alone, since `fragment()` is not exported: `lint/engine/compiler/decision.js` builds and enforces nothing. The walk imports every `.js`, `.mjs` and `.cjs` module of `lint/` and `src/`, and collects every fragment anywhere in what each exports, by default or by name, whether a profile carries it or not. It leaves out `src/cli/`, whose executables act when imported — the folders the self corpus hands it with the walk, `FRAGMENT_WALK`. The module walk reaches those: it imports one module in a child of its own, with every `fragment` a module of the tree exports wrapped to record what it builds, the process's exit refused, and a bare command line in an empty directory. What the module exports and what its import built are both judged.

One refusal of those invariants is split, because a consumer reaches `fragment()` through `layers()`, which forwards the `id` it is given: a fragment with no id is a self rule the audit names, and its consumer half is `layers()` refusing an `id` that is not a non-empty string.

The catalogue itself ships, since `fix` reads its unsafe fixers; the table and the fixer list [Lint presets](07-lint-presets.md) carries between its `GENERATED` markers are rendered from the consumer entries alone.

The selector is `TYPESCRIPT_CHECK_PASSES`, a comma-separated list of pass keys, and the shipped `bin/commands/check.sh` holds no copy of it: its `selected` answers yes for every pass, defined after anything bash inherits or sources first. The specs run the product command through `specs/cli/check-selection.sh`, exported as `SELECTING_BIN` by `specs/cli/check-passes.ts`: the `cli` runner for every document, and each chain that spawns the check with `onlyPasses()`. It hands every run to `bin/typescript.sh`, unless the run is `check` or `fix` and names some passes. Then it runs the published check from its text, with its `selected` replaced by one that answers for the passes named, and its own directory set, which a script read from text cannot find. It refuses a check whose text no longer holds exactly one of each line it replaces. A pass the selector leaves out prints nothing and weighs nothing in the verdict, and a key that names no pass fails the run with the list of keys, the `consumer` checker rows. A pass another one reads still runs, unreported: the linter under the conventions checker's member runs, and the Names pass under the ratchet's held line. The specs prove what a run reports and its verdict, not which passes it launches: leaving a pass unlaunched is what saves the time, and no spec goes red if it starts again. The spec documents, apart from the three `passes-*.spec.yaml` that prove the selector, and a chain that names no pass, run every pass.

### What holds the split

`lint/self/corpus/audience.test.ts` reads this checkout's catalogues. Every manifest row declares an audience, as every fragment does beside the decision invariants, over the same walk, and every row sits on a channel under an id of its own. Every profile is compiled from consumer fragments alone. The consumer checker rows are exactly the passes `bin/commands/check.sh` selects. A shipped module or script of `lint/`, `src/` or `bin/` refuses as often as its runtime rows declare, counted off its text per way: a throw of an error it builds, `throw new X(` or `throw X(`; a `reject(`, whatever it rejects with; and an exit with anything but 0, as `exit(` in a module or, in a script, `exit` handed `1` to `9` or a variable's value. A rethrow of a caught error forwards a refusal and is not counted, nor is an error built on one line and thrown by name on another. Each row is still worded so there. Each self row's home exists, holds every name the row gives, and is a path npm would not publish.

`specs/surface/package/tarball.test.ts` reads what npm would publish, judging content and never names. No `*.test.*` or `*.spec.*` ships. Every file the packed `exports` map names, under each condition Node loads, is there, loads, and reaches consumer fragments alone; a `*` matches as Node matches it, `/` included. Every rule the six packed profiles state, at their top or in an override, is a consumer decision the packed catalogue holds for that profile, at that level. `hexagonal` is its consumer fragment compiled. The catalogue's module exposes `decisions()` and `unsafeFixers()` alone, each handed the profile table, and every pass the packed check selects is a consumer row. Every `selected` the packed shell scripts write outside a comment is either its one definition, answering yes for every pass, or a call naming a consumer pass, so a second definition in any spelling, `function selected {` included, fails it. The module walk reaches every JavaScript module the tarball holds, and every command its `bin` installs that is not a shell script, and every fragment it finds is consumer. The walk sees what an import builds, not what a builder builds when a consumer calls it later, `layers()` included, so `specs/surface/package/builder-calls.test.ts` reads the packed text: every call a packed module makes to `fragment()` hands it an object literal whose `audience` is a string literal, with no spread; a namespace import or a re-export of `engine/compiler/decision.js`, or the builder handed on as a value, fails it. With no `self` literal in the tarball, a fragment built through the builder is consumer whenever it is built. A fragment-shaped object built without the builder is the walk's alone. Every shell command the `bin` installs runs over an empty folder: bare, then under a `selected` bash inherits, one the file `BASH_ENV` names defines, the specs' selection, and every variable of any case the packed scripts read and never assign naming a pass; then handed each flag a `case` arm of theirs matches, followed by a pass. Each run reports the same passes to the same verdict as the bare one. What the proof does not reach is a choice read from somewhere else: a flag tested outside a `case` arm, or a file the project holds. No file of the tarball holds a self row's id, one of its names, or its home's file name, and none declares an audience of `self`.

`specs/surface/package/shipped-links.test.ts` reads the same packed tree against this checkout. A relative link a packed file carries to a page this checkout keeps must land in the tarball, so a shipped page names this chapter, and the skill, by their repository URL. The map, `docs/README.md`, keeps its relative row for this chapter, since the Docs (layout) pass holds it to one row per chapter.

## The self-lint is the strongest test

`npm run lint` is `typescript check` run on this repository, so the package is the first consumer of every gate it ships:

- the **Docs (layout)** pass reads this repo's own `docs/`, which is why the chapters you are reading carry the spine the rule demands;
- `oxlint.config.ts` loads the `@jterrazz/test` ESM plugin through the exports map, and `check` type-checks `specs/` plus `src/index.d.ts` — a broken exports map fails the lint, not a consumer;
- the same config composes `lint/self/index.js`, which compiles `lint-direction`, a `layers()` map over this repository's own tree declared in `lint/self/checks/lint-direction.js`: the direction of `lint/` [Architecture](01-architecture.md#the-judging-layer) draws — `engine/` importing no declaration, each consumer folder the catalogue and the engine alone — the shipped `lint/` importing no `src/`, and `src/` no `self/` — so an import against it fails the Oxlint pass.

A change that passes `npm test` but not `npm run lint` is not finished.

## Related

- [Developing](02-developing.md) — the gestures, and where a new file goes.
- [Quality checks](06-quality-checks.md) — what each gate refuses.
