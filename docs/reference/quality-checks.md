# Quality checks

`typescript check` runs every quality pass in parallel and fails on any finding; `typescript fix` repairs what can be repaired without a human. This page is the reference of both: one section per pass, in the order a run prints them, then the ratchet that holds a project's debt and the drift report that closes every run.

## Reading a run

Every pass that ran prints the same block: a `RUN` header carrying its name, whatever it has to say, and one verdict line. A pass that did not apply, such as Astro in a project without Astro, prints nothing at all, because it answered no question.

A failing pass prints its whole log. A passing one stays silent, unless it wrote something (`fix` changed a file the operator owns) or a ratchet held it. A tool's success chatter never reaches the stream, so a green run is the same on every platform.

A finding the toolchain writes is one line in the compiler's convention, `path:line:column: error <pass>(<rule>): …`, followed by its lesson in four parts: `found: … · why: … · fix: … · read: …`. The `read` is a heading of this manual, so a reader lands on the section that explains the rule.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package pass once per member, and a single-package project is the same run it always was.

### Flags and exit codes

`check` and `fix` run whole, every pass that applies over the whole project: no flag runs one pass or one file. `check` takes one flag, and `fix` none:

- `--json`, on `check`, prints [the drift report](#the-drift-report) as one JSON object for a machine; every pass above it still prints for a person.

Any other flag, or `--json` given twice, is refused before a pass starts, and `--help` prints the command's usage and runs nothing ([Commands § Flags and help](commands.md#flags-and-help)).

Every command exits `0` when it succeeded and non-zero otherwise; `check` and `fix` exit `1` when any pass failed or the drift report refused. CI runs `make check` and reads that code, and on a GitHub runner oxlint prints its diagnostics as workflow annotations ([One run, printed as oxlint prints it](#one-run-printed-as-oxlint-prints-it)).

A runner owes Node 24 and the install the lockfile describes, nothing more: the TypeScript 7 compiler arrives as the optional package of the runner's own platform, and the Secrets pass runs `gitleaks` only where it finds one on `PATH`, falling back to its own patterns. The repositories of the family call the shared `jterrazz/jterrazz-actions` validate workflow, which runs `make build`, `make lint` and `make test` on Node 24; a project outside the family writes the same in a few lines:

```yaml
# .github/workflows/validate.yaml
name: Validate
on: [push, pull_request]
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: '24', cache: npm }
            - run: make install
            - run: make check
```

`fix` rewrites the project's files in place — the formatting, the linter's safe fixes, the order of `package.json`, the `.gitignore`, two directive spellings, empty directories, the baseline's fallen counts. Run it on a committed tree, and read its diff before committing it.

## The passes

`typescript check` runs up to sixteen passes, one per row below. The Config pass runs first, three spawn a tool on every invocation (tsc, oxlint, oxfmt), knip and five tree gates (Gitignore, Suppressions, Markdown, Names, Secrets) run on every `check`, and the other six are opt-in — a preset's checks, Docs, Publish, Architecture, Astro and Comments appear only when the project qualifies. [Mutation](#mutation) is a command of its own, not a pass of `check`.

| Pass                             | Tool                        | When it runs                                                                                                                 |
| -------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Config (one file)                | the config gate             | always (check and fix — `--fix` writes the derived files)                                                                    |
| TypeScript Check                 | tsc (TypeScript 7, Go)      | always — in a workspace, once per member, each by its own `tsconfig.json`                                                    |
| Oxlint Check                     | oxlint (`--type-aware`)     | always (judged by the ratchet's `typescript` section where there is one)                                                     |
| Oxfmt Check                      | oxfmt (Rust)                | always                                                                                                                       |
| Gitignore (artefacts)            | the artefact gate           | check: project or ancestor `.gitignore`; fix: project's own                                                                  |
| Knip (unused code)               | knip (Node)                 | always (check only — it is not run in fix)                                                                                   |
| a preset's label                 | the preset's checks         | per `specs/` root and per member, for each declared preset that brings checks (check and fix)                                |
| Docs (layout)                    | the manual gate             | check: at a repository root (a `.git` beside the project)                                                                    |
| Publish (packaging)              | publint + attw + a build    | per unit that declares a `library` or a `cli` and is not `private`                                                           |
| Architecture (layer map)         | dependency-cruiser          | a `jterrazz.config.ts`, or a `.dependency-cruiser.*` (check and fix — `--fix` re-records a fall)                             |
| Astro (check + format)           | astro check + prettier      | per unit that declares the `astro` platform (check and fix)                                                                  |
| Suppressions (directives)        | the suppression gate        | always (check and fix — `--fix` settles two spellings)                                                                       |
| Comments (styles, scripts, YAML) | the comment gate            | a tree holding a style sheet, a script, a Makefile, a Dockerfile or a YAML file (check only — `fix` never deletes a comment) |
| Markdown (prose)                 | rumdl + the prose gate      | always (check and fix — `--fix` runs rumdl's own fixes)                                                                      |
| Names (tree)                     | ls-lint + the naming gate   | always (check and fix — `--fix` deletes an empty directory)                                                                  |
| Secrets (credentials)            | gitleaks, else the patterns | always (check only — a leak is rotated, not reformatted)                                                                     |

`typescript fix` runs the config gate, tsc, oxlint (`--fix`), the artefact gate, the suppression gate, the comment gate, dependency-cruiser (`--fix` re-records a fall), rumdl (`--fix`) with the prose gate, and the naming gate — knip, the conventions checker, the Docs (layout) pass and the remaining tree gates are check-only (they are read-only gates, not fixers). The formatter writes last: every other writer of the run has laid its text down before oxfmt lays it out, so no writer rewrites what the formatter settled and no run leaves a tree its own check refuses. Oxlint judges what is left after the formatter, since a file crosses `max-lines` or a function `max-lines-per-function` only on the layout oxfmt writes, and a `*.spec.yaml` is laid out by the test package's document formatter alone, which oxfmt is told to leave.

### In a workspace

When the `package.json` at the cwd declares `workspaces` — or, for a pnpm workspace, which keeps no such field, when `pnpm-workspace.yaml` lists `packages` — the per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/package.json` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed. The root's formatter and linter configs carry what each member keeps as written, under the member's folder, and a member's own overrides carry the member's plugins and come before the root's, which win.

The Docs (layout) pass measures from neither: its unit is the repository, and the section below says why.

tsc runs once per member too, each run by the member's own `tsconfig.json`, since a workspace root keeps none. Three passes are root-only, and that is not an omission. oxlint and oxfmt measure from their **config file**, which a workspace keeps at its root alone, and each already reaches the whole tree through the project's files it is handed. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

Discovery never leaves the workspace. A candidate is dropped when git ignores it — clones, workbenches and build output live under gitignored paths — and when the walk had to cross a nested `.git` or a `package.json` that no workspace glob claims to reach it: a vendored project's conventions are its own, not yours.

### Leaving a path out

Four doors, each narrower than the one before it. There is no flag: `--ignore-pattern`, which once left a path out of one run, is retired, since each gate read it differently — the formatter, the Markdown pass and the linter disagreed on what it covered, and one run rewrote 85 goldens — and it is refused with the declaration below as its fix.

- **`.gitignore`.** The linter, the formatter and every tree gate read the same sweep, the files git does not ignore, so a path git ignores is out of all of them: generated output, a local data folder.
- **`typescript.roots.<folder> = { reason, verbatim: true }`** in `jterrazz.config.ts`: a tracked folder kept as its author wrote it — quoted upstream text, signed articles, a script's output. One declaration reaches every gate alike: the formatter and the Markdown and Comments passes leave it as written, the Names pass judges no name in it, oxlint lints nothing of it, the derived `tsconfig.json` excludes it, and Suppressions reads no directive of it. Secrets reads it all the same: a credential is a credential in quoted text. The platforms' tool roots served verbatim (`public/`, `assets/` on expo and astro) are verbatim without a declaration.
- **`typescript.oxlint.overrides`** or **`typescript.oxfmt.ignore`** in `jterrazz.config.ts`, each with its reason: the rules a set of files is judged by, or the files the formatter leaves as written ([Configuration § The lint rules](configuration.md#the-lint-rules)).

tsc reads the files its tsconfig preset includes, and knip what its preset and the project's `typescript.knip` name ([Lint presets](lint-presets.md#unused-code-knip)): neither reads the sweep.

### An unreadable tree

Every tree gate reads the same sweep: the files git does not ignore, or the disk outside a git checkout. A sweep that comes back empty while the tree holds something — folders and no file, or files git ignores whole — is refused rather than read as nothing to judge, since a gate over nothing passes. The pass prints the refusal in four parts, `found: … · why: … · fix: … · read: …`, and fails.

## The Config (one file) pass

The root holds what a person wrote, and one file says what the project is. This pass holds both: `jterrazz.config.ts` declares a kind and a platform from the two closed lists ([Getting started](../start/getting-started.md#1-declare-what-the-project-is)), the files an editor reads at the root are the lines that declaration derives, and no tool keeps a config of its own beside it. It runs first, at the root and in every workspace member, and reads nothing but those files and the manifest.

<!-- GENERATED:findings config -->

| Rule                                 | Requirement                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/project-declared`            | A repository, and each member of a workspace, declares what it is once — its kind and its platform — in jterrazz.config.ts.                                                                                                                                        |
| `config/settings-load-synchronously` | A settings file loads synchronously too, since the oxlint rules read jterrazz.config.ts so, and one they cannot load would leave them judging on defaults.                                                                                                         |
| `config/editor-file-derived`         | Each config file an editor discovers is the file jterrazz.config.ts derives, so the editor and the check judge alike.                                                                                                                                              |
| `config/editor-file-in-its-unit`     | An editor file sits in the unit it is derived for: the oxlint and oxfmt configs at the repository root alone, a tsconfig.json — or a preset's file such as vitest.config.ts — in each declared project, and never at a workspace root, which declares no platform. |
| `config/no-tool-config`              | A tool only the toolchain runs keeps no config file of its own: the command hands it the config jterrazz.config.ts derives.                                                                                                                                        |
| `config/kind-matches-manifest`       | A library publishes its exports, a published cli names its bin, and an application — an api, a website, a mobile app — is private, never published, as is a workspace's own suite.                                                                                 |
| `config/manifest-is-a-module`        | A project is an ES module, its manifest setting "type": "module": the vitest config the toolchain derives and the names its build gives the files are ESM's, and a package without it fails in both without saying why.                                            |
| `config/manifest-keys-known`         | A manifest holds the top-level keys npm and the family's tools read: a key beyond them reads nothing, and a typo of one fails without a word.                                                                                                                      |
| `config/tsconfig-addition-reasoned`  | What typescript.tsconfig adds to the derived tsconfig.json carries its reason, since every setting maps to why it is set.                                                                                                                                          |
| `config/standard-is-data`            | A package's standard under src/standard/ is data: no function, branch, call or variable but the defineStandard each file exports.                                                                                                                                  |

<!-- /GENERATED:findings config -->

### The derived files

An editor reads `oxlint.config.ts`, `oxfmt.config.ts` and `tsconfig.json` by their names, so they stay at the root, but their content is the toolchain's: the oxlint and oxfmt configs hand their own `import.meta.url` to the `oxlintConfig` and `oxfmtConfig` of the `./oxlint` and `./oxfmt` entries, which derive the config from the `jterrazz.config.ts` of the module's directory — the `url`, never `dirname`, which a browser platform's types do not declare, nor the `import.meta` object, which knip's loader, jiti, hands over as its own wrapper's — and the tsconfig is an `extends` of the platform's preset, with what `typescript.tsconfig` adds to it and why. A config names its directory because nothing else knows it: an entry deriving from the directory the tool runs in dropped every preset and setting, with no error, when oxlint ran from `src/`, and Node loads an entry once per process, so a language server serving two projects would hand both the first one's config. What was run as an editor runs it: `oxlint --lsp` started at the project root loads the config and reports the profile's rules, `oxfmt --lsp` formats a file at the root and one in a subfolder by the derived config, the TypeScript 7 language server resolves the `extends`, and the Vitest extension loads `vitest.config.ts` from its own directory. The oxlint language server watches `oxlint.config.ts`, not `jterrazz.config.ts`: an edit of the declaration reaches the editor when the server reloads its config — save `oxlint.config.ts`, or restart the server — and a rule that reads settings while it lints keeps its first read until the restart. Started on a folder above the project — an estate of nested clones opened whole — oxlint, CLI and language server alike, finds the config as a nested one, refuses the `options.typeAware` it sets, and lints with its own defaults: open the editor on the project. A workspace keeps the two configs at its root alone, which derive each member's own rules; a file every unit keeps — a `tsconfig.json`, or a preset's own such as `@jterrazz/test`'s `vitest.config.ts` — is owed by each member and never by the workspace root.

`typescript fix` writes every derived file that is missing or says something else, before any other pass starts, so a project holding nothing but its declaration is linted, formatted and type-checked by the files it derives; `check` names the content to write. A setting that once lived in one of them — a rule turned off, a path the formatter skips — moves to `jterrazz.config.ts`, under the section its owner reads, with its reason ([Configuration](configuration.md#the-typescript-section)).

### No config of its own

knip, tsdown and Stryker are run by the command alone, which derives their config and hands it over by path, so a `knip.json`, a `tsdown.config.ts` or a `stryker.config.json` at the root is a second place a setting could hide. So is an alternate name of an editor file (`.oxlintrc.json`, `oxlint.config.mts`), a `.dependency-cruiser.*` or `.ls-lint.yml`, a second vitest config (`vitest.<name>.config.ts`), and a member's own `oxlint.config.ts`, which would replace the root's in its subtree. Each is refused, naming where its settings go.

### The kind and the manifest

The kind says what the manifest must hold: a `library` publishes `exports` or a `main`, a `cli` names its `bin` unless it is `private` — a binary its repository installs itself —, and a workspace's own suite, which declares no kind, is `private`. A project that declares itself one and publishes as the other is refused at its `package.json`, since every law that follows from the kind would judge the wrong thing.

A manifest key beyond those npm and the tools of the family read is refused (`config/manifest-keys-known`). A key that carries information for a reader — a credit, a fork's origin — moves to the README: the rule cannot know which keys are attributions, so the fix text says so once for them all, and no per-key list exists.

## The Gitignore (artefacts) pass

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root ([Getting started](../start/getting-started.md#where-a-tools-output-goes)), and this pass reads that convention off two files: the project's own `.gitignore`, and the nearest ANCESTOR `.gitignore` above it — the workspace root's, found by walking up to the nearest directory holding a lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `npm-shrinkwrap.json`) or a `workspaces` manifest. That walk stops at the nearest repository boundary and never passes it — a `.git` directory in a clone, a `.git` file in a worktree — because a clone checked out inside another repository is not a member of the tree it sits in, and the `.gitignore` above that boundary answers for somebody else's artefacts. A project carrying its own `.git` therefore has no ancestor at all. It runs when either file exists — a project with neither names no artefact path — and each is judged by the same rules.

The second file matters in a workspace whose `lint` DELEGATES to members — each one calling `typescript check` on its own, cwd'd there. Without it, a member with no `.gitignore` of its own would pass silently even when neither it nor the root ever declared the convention: the pass is opt-in on a file's existence, and only the package's own file used to be asked. An ancestor's pattern counts only when it is not ANCHORED to the ancestor's own directory — `.artifacts/`, not `/.artifacts/` — the same rule git applies when deciding whether a pattern reaches into a nested directory; a root that ignores `.artifacts/` this way covers every member beneath it.

Four things fail it:

- **An artefact named outside `.artifacts/`** — `*.tsbuildinfo`, `.next` (see the conditional exception below), `out`, `build`, `coverage`, `target`, `test-results`, `playwright-report`, a `*.log`, `.vite`, `.cache`, or `bin/` (a Go output). The message names the `.artifacts/<tool>/` home each one moves to, and which file — the project's own or the ancestor's — named it. A pattern is read by the segment that carries its meaning, so `packages/*/coverage` and `coverage/` fail alike.
- **`.artifacts/` not ignored by either file** — the convention's own directory must never reach a commit. When a workspace root exists, the message points at it — that is the shared file the fix belongs in.
- **A committed artefact** — a tracked `*.tsbuildinfo`, or a tracked file under `.artifacts/`, `.next/`, `.turbo/`, `.vite/`, `.cache/`, `coverage/`, `playwright-report/` or `test-results/`. The remedy is `git rm --cached`, and it stays yours: the pass never deletes a file git is tracking.
- **A turbo cache outside `.artifacts/turbo/`** — a `turbo.json` at the project root whose `cacheDir` is unset or names another path. `fix` sets it.

`dist` is the one exception the convention itself carves out — a build's product stays beside `src/` and is published from there.

### The closed exception list

These ignored paths are not artefacts of the convention, and the pass says nothing about them: `.expo/`, `ios/`, `android/`, `next-env.d.ts`, `.vercel`, `.build/`, `.swiftpm/`, `Package.resolved`, `DerivedData/`, `.gradle/`, `.metro-health-check*`, `.turbo/`, `node_modules/`. Each is a platform working directory a toolchain owns and cannot be told to move, or a file a framework expects at a fixed path. The list is closed: a path that is not on it and matches an artefact form fails.

`.turbo/` is the one member a tool moves only HALF of: Turborepo pins its per-task log at `<package>/.turbo/turbo-<task>.log` with no key, flag or environment variable to relocate it, while its cache obeys `cacheDir` and still belongs at `.artifacts/turbo/`: a `turbo.json` whose `cacheDir` is anything else, or unset — the default is `.turbo/cache` — fails the pass, and `fix` sets it. Ignoring the directory is granted; committing what it holds is the tracked-file failure above.

One more exception joins the list CONDITIONALLY: `.next`, but only when the project's `next.config.*` declares `output: 'export'`. In that mode Next reads `distDir` as the export destination and keeps its working directory pinned at `.next` regardless — `next/dist/export/utils.js`'s `hasCustomExportOutput` refuses to move it, proven by a real consumer's static site. The pass reads the config file textually for `output:\s*['"]export['"]`; without a match — including when there is no `next.config.*` at all — `.next` stays an ordinary artefact whose home is `.artifacts/next/`.

### What `typescript fix` rewrites

Fix mode rewrites the package's OWN `.gitignore` only — never an ancestor's, which is a different project's file, and never one that does not exist, since fix repairs a file, it does not create one. The artefact lines go, `.artifacts/` arrives, and everything else — the comments, the blank lines, the order, the project's own paths — survives untouched. It reports every line it removed and prints the file's negations, which it never touches: a `!` line rescues a tracked file, so what to do with one is a judgement, not a rewrite. A committed artefact is reported in fix mode too and still fails the run — untracking a file is not something a formatter should decide.

## A preset's checks

A preset may bring checks of its own beside its laws: its `checker` names a module whose default export is a `Contribution` of the [rules kit](rules-kit.md) — its passes, the baseline section they hold, its commands — and the label its verdict is printed under. `@jterrazz/test`'s `test()` brings its conventions this way, under `Test Conventions (@jterrazz/test)`, and the question they answer is "does this project write specs the way the framework says". There is no second command: `typescript check`, `fix` and `baseline` run every declared preset's checks through this package's own checker program, and the module is a declaration, never a program of its own.

A preset's checks run once over the repository, at its root, and the preset walks what it owns there itself — `@jterrazz/test`'s conventions read every `specs/` tree and every workspace member, a member with no `specs/` included, since a package with a `test` script and no `vitest.config.ts` owns a question no specs tree can be asked. The toolchain knows the units, never what a preset judges inside them. A member that declares presets of its own in its own `jterrazz.config.ts` is run once more, `--member <dir>`, by the checks its file imports — its own install, not the one the root hoisted — and a project with no declaration is judged by none: a clone sitting inside another tree is never judged by the presets the tree around it declares.

The verdict is the checks' exit code, and nothing here forgives it: a preset records its own debt and judges it, in its own section of the ratchet file ([the ratchet](#the-ratchet)). `fix` runs every preset's checks with `--fix` first, one run after another, before oxlint and the formatter, so the last writer of every file is the one `check` judges its format by; `baseline` runs the `baseline` command of each preset holding a section of debt after recording its own sections; a preset holding no section is skipped.

A green pass says one thing about each section a listed preset holds: the held line of the run over the project root, `.jterrazz/baseline.json › test: <n> held across <k> rules` — or `.jterrazz/baseline.json › test: nothing held` for a project keeping no `test` section. The sections are the ones the presets of `jterrazz.config.ts` declare in their `baseline`, the toolchain's own aside, so a preset that declares no section is shown no line; a line in any other shape is left out rather than echoed as a second shape.

A preset's checks judge their own passes and nothing of oxlint's: a plugin's `jterrazz(*)` diagnostics are oxlint rules, printed by the Oxlint pass and held in `.jterrazz/oxlint-suppressions.json` ([the ratchet](#the-ratchet)). So the runs start beside the linter rather than after it, and none of them lints the project.

## The Docs (layout) pass

Every repository carries the same shape of manual — a map at `docs/README.md` and its pages cut into four sections, `start/`, `guides/`, `concepts/` and `reference/`, beside `decisions/` and `_assets/` — and this pass refuses a tree that breaks it.

Three pages are required of every manual: `concepts/architecture.md`, `guides/develop.md` and `guides/test.md`; a repository that ships an image or a package also holds `guides/release.md` — a workspace ships a package when any of its members does, not only when its own root does. A page is named for its subject in kebab case, with no number, and sits directly in its section: the map gives the order. This shape is not [the root spine](#the-root-spine), the folders a repository root may hold, which the Names pass judges. `decisions/` is optional: a manual with none owes neither a record nor a template.

Its unit is the **repository**, not the package: a manual answers for a whole tree, and only its root carries the `AGENTS.md` that routes into it. So the pass asks its question exactly where a repository is — a `.git` beside the project, a file in a worktree and a directory in a clone — and nowhere else. A fixture directory is not a repository, and neither is a workspace member linted on its own.

Nothing else gates it. A repository with **no** `docs/` at all is not exempt; it is the case the rule exists for, and it fails on `docs/manual-present`.

Why a manual has this shape is language-agnostic doctrine, and it is the estate's, written in [jterrazz-studio's repository structure chapter](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/11-repo-structure.md): the sections and what each holds, the water line between a repository's manual and its brand's wiki. What this page owns is the rule ids and what each one refuses. The sentence a rule prints is not here — it lives in the pass, `lint/consumer/checks/docs.ts`, so a page and a gate cannot drift.

<!-- GENERATED:findings docs -->

| Rule                                        | Requirement                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/manual-present`                       | Every repository carries a docs/ manual.                                                                                             |
| `docs/agents-route-to-the-map`              | The root AGENTS.md routes to the manual's map.                                                                                       |
| `docs/map-present`                          | The manual opens on its map, docs/README.md.                                                                                         |
| `docs/map-matches-pages`                    | The map links every page of the four sections, and only the pages there are.                                                         |
| `docs/map-links-only-pages`                 | The map links nothing but its own pages and decisions/.                                                                              |
| `docs/page-named-in-kebab-case`             | A page is named kebab-case.md, with no number.                                                                                       |
| `docs/section-is-flat`                      | A section holds pages and no folder.                                                                                                 |
| `docs/required-pages-present`               | The manual holds concepts/architecture.md, guides/develop.md and guides/test.md.                                                     |
| `docs/release-guide-present-when-shipping`  | A repository that ships an image or a package carries guides/release.md.                                                             |
| `docs/page-names-a-subject`                 | A page is named for a subject, never for the state of a piece of work.                                                               |
| `docs/no-loose-file`                        | The only file directly under docs/ is the map.                                                                                       |
| `docs/no-unknown-subfolder`                 | The manual holds no folder but start/, guides/, concepts/, reference/, decisions/ and _assets/.                                      |
| `docs/no-cross-repository-link`             | No link of the manual reaches into another repository's tree.                                                                        |
| `docs/decision-named-by-number-and-subject` | A decision record is named NNN-kebab.md.                                                                                             |
| `docs/decision-heading-carries-its-number`  | A decision record opens on # ADR-NNN: Title, with its own number.                                                                    |
| `docs/decision-number-unique`               | One ADR number belongs to one record.                                                                                                |
| `docs/decisions-numbered-contiguously`      | Decision records are numbered from 001 without a gap.                                                                                |
| `docs/decision-status-known`                | A decision record states a status from the closed vocabulary.                                                                        |
| `docs/decision-listed-in-the-map`           | The decisions folder keeps no hand-written index, no decisions/README.md: the map links the folder, and the records list themselves. |
| `docs/decision-template-present`            | A manual that keeps a decisions folder carries its _template.md in it.                                                               |

<!-- /GENERATED:findings docs -->

Three things about the roster are decisions, not details:

- **The `guides/release.md` presence test is derived, and there is no configuration key.** It fires on a `Dockerfile` (or `Dockerfile.*`), on an `.infrastructure/` directory — either at the repository root or at a workspace member's root, since a monorepo deploys from a member as readily as from its root — or on a root that declares a kind npm publishes — a `library` or a `cli` whose manifest is not `private` ([Configuration](configuration.md#kind-and-platform)). The publishable clause reads the root's declaration alone: a workspace root holding a published member is a question for its owner, not a verdict for a gate, and a root that declares nothing publishes nothing.
- **`docs/no-cross-repository-link` refuses a path, never a URL.** A link that starts with `/`, or whose relative path climbs above the repository root, reaches into whatever clone sits beside this one on one machine and breaks on every other. An absolute `https://` link to another repository on GitHub resolves for every reader, so it is how a manual cites a sibling's page, as this one cites jterrazz-studio's.
- **The pass only ever REQUIRES a page; it never forbids one.** A repository that releases by a tagged workflow and ships neither an image nor a package writes its `guides/release.md` and hears nothing about it. Machine-holding the other half would mean parsing `.github/workflows/**`, which is another repository's shape.
- **The journal-word roster is closed, and it is in the code.** `exploration`, `review`, `notes`, `proposal`, `draft`, `wip`, `old`, `legacy`, `misc`, `todo` — matched as whole words of a page's name. No page keeps a second copy of it; the one that matters is executable.

### Outside an npm project

```bash
npx --yes --package=@jterrazz/typescript -- typescript docs-layout .
```

The `--package` flag and the bin name are both spelled out on purpose: the shorter `npx @jterrazz/typescript docs-layout .` lets npm infer the command from the package name, and that inferred name — `typescript` — collides with the `typescript` package this one depends on, which crashes npm's resolution of the ephemeral install tree on some npm/Node combinations even though the short form works on others.

The same gate, on any tree: a Go, Rust or Ansible repository wires that line into its own `make lint`. It needs nothing installed, takes the repository root as its argument, and prints one line per violation as `<rule>  <path>  <message>`. Unlike the pass it never asks whether the tree is a repository — the operator already said so by running it. It is `docs-layout` because the pass it runs is Docs (layout): one name for the gate, whichever door reaches it.

### Reusing the rules

The rules are a pure function, exported at `@jterrazz/typescript/docs`:

```ts
import { auditDocs } from '@jterrazz/typescript/docs';
import type { DocsTree } from '@jterrazz/typescript/docs';

const tree: DocsTree = {
    agents: null,
    files: ['docs/'],
    heads: {},
    links: {},
    ships: { dockerfile: false, infrastructure: false, publishable: false },
};

export const violations = auditDocs(tree);
```

A `DocsTree` is a plain description of one repository: the paths under `docs/`, the opening lines of each page, each page's link targets, the root `AGENTS.md`, and the three presence facts. Each violation is a `{ rule, path, message }`, its `rule` typed `DocsRule` — the union of the pass's ids, `DOCS_RULES` as a value — so a consumer that compares a rule id stops compiling when a release renames it, rather than reading every tree as broken. No filesystem, no transport: a sweep across clones nothing has been installed into judges by the same copy of the rules as the gate. `HEAD_LINES` says how far down a page a rule reads, so a `**Status:**` below it is a status the manual does not declare.

## The Oxlint pass

`--type-aware` is passed explicitly and unconditionally. The rules it unlocks are the ones no syntactic linter can express, and a flag that is only sometimes passed is a rule set that is only sometimes enforced. Those rules run in `tsgolint`, a separate binary oxlint looks up on PATH; `oxlint-tsgolint` is a dependency of this package, and the command puts the directory holding it in front of PATH for its own children, so a consumer never installs or configures anything.

The linter is handed the project's files it parses rather than the directory, the same sweep every tree gate reads: every file git does not ignore — tracked, or new and not yet added — and nothing git ignores. A new module is linted before anyone runs `git add`, and a local data folder the gates must not read belongs in `.gitignore`, so the CLI, CI, the baseline and the editor judge one tree. Outside a git checkout the sweep walks the disk. The profiles' own ignores and the roots declared verbatim still apply on top. A sweep that refused an answer hands the linter the directory instead, so a gate never goes silent on a read it did not make, and the derived oxlint config carries the roots declared verbatim as its own ignores, in `check` and in both runs of `fix`: without them, the directory's walk would lint and fix what the repository declared kept as written.

### The config it runs with

oxlint finds the project's `oxlint.config.ts` where it looks, and that file is the derived one the [Config pass](#the-config-one-file-pass) holds it to: the config derived from `jterrazz.config.ts` — the platform's profile, each preset's rules, the project's `typescript.oxlint`, and in a workspace each member's own, scoped to its folder ([Lint presets](lint-presets.md#how-the-config-is-merged)). Where the file is missing, `check` hands oxlint the same derivation by path, a private entry reading the project root it runs in, so the run lints by the same config while the Config pass names the file to write; left to itself oxlint would walk up the tree for a config and apply whatever the folder the project sits in happens to hold. `baseline` hands the same config, so the ledger records what `check` reports.

A config handed by path resolves its `ignorePatterns` against its own directory, which is this package's. So the sweep leaves out what the derived patterns name instead, and a project with no file is spared the same folders as one with it.

### One run, printed as oxlint prints it

`check` runs the type-aware linter once, and what a failing pass prints is oxlint's own output, in the form oxlint picks for the environment: one line per diagnostic under an AI agent, GitHub workflow commands on a GitHub runner, the framed report anywhere else, in colour where `CI` or `FORCE_COLOR` asks for it. The toolchain draws nothing of its own: the type-aware run is the costliest process of a check, and a second run, or a renderer re-drawing a JSON report, would only repeat what oxlint already says. The run's verdict is oxlint's exit code, the suppressions file included ([the ratchet](#the-ratchet)); the pass adds a line only where oxlint's own words would send a reader astray — a config it could not load, or a help naming a bare `oxlint --suppress-all`.

A preset's checks read no oxlint report: a plugin's `jterrazz(*)` rules are oxlint rules like any other, printed and held here.

`fix` runs the fixers — one wrapped run per config scope, [below](#a-nested-config-fixes-its-own-subtree) — then prunes the suppressions file, then makes the same run `check` makes, whose output and exit are the pass's: so `fix` and `check` read the same verdict on the tree the fixers left. The fixers' own output is printed only when one of them could not run.

### The two refusals that are not diagnostics

A lint run can be green about nothing, and neither way shows up as a diagnostic. Both are the pass refusing, both are written into its own log, and both fail it — after them the verdict is on what the linter RAN, not on what it managed to exit with.

| Rule                     | Refuses                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `oxlint-config-unparsed` | a config oxlint could not parse, so it linted nothing      |
| `oxlint-config-commonjs` | a CommonJS config, which oxlint drops whole and in silence |

The first is usually a `jsPlugins` naming a module that is not there. oxlint prints `Failed to parse oxlint configuration file` above the pass's own line, and this names the refusal in the toolchain's vocabulary rather than leaving a reader with a tool's text.

The second is the silent one: a `.cjs` config, or a `.js` config in a package that is not `"type": "module"`. oxlint prints NOTHING and exits 0, so the run reads as green having enforced no rule the config named. Everything this package ships is ESM and so is every oxlint JS plugin the estate writes — a CommonJS config cannot load either.

### The fixers fix mode refuses

A fixer that changes MEANING is never applied unattended, so the oxlint run of fix mode turns off each rule marked `unsafe` in the manifest — the rewrite does not land, the diagnostic stays — `fix` and `check` report it alike — and a human answers it. The list, and what each rewrite does, is [Lint presets](lint-presets.md).

oxlint has a safe/dangerous split of its own — `--fix` applies the safe fixes, `--fix-dangerously` the rest — and it covers none of the eleven. Measured on oxlint 1.85, each rule alone on a sample that triggers it:

| Rule                                        | oxlint's fix kind                | Plain `--fix` rewrites                                  |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `typescript/no-confusing-void-expression`   | `fixable_safe_fix_or_suggestion` | yes — an arrow's void body into a block                 |
| `typescript/no-unnecessary-type-assertion`  | `fixable_fix`                    | yes — `s as string` into `s`                            |
| `typescript/promise-function-async`         | `conditional_fix`                | yes — adds `async` to a promise-returning function      |
| `unicorn/no-useless-promise-resolve-reject` | `fixable_fix`                    | yes — `return Promise.resolve(1)` into `return 1`       |
| `unicorn/no-useless-undefined`              | `fixable_fix`                    | yes — `take(undefined)` into `take()`                   |
| `unicorn/prefer-import-meta-properties`     | `fixable_fix`                    | yes — `fileURLToPath(new URL('.', …))` into the dirname |
| `vitest/consistent-test-it`                 | `fixable_fix`                    | yes — `it(` into `test(`                                |
| `vitest/prefer-called-with`                 | `fixable_fix`                    | yes — `toHaveBeenCalled()` into `…CalledWith()`         |
| `vitest/prefer-import-in-mock`              | `fixable_fix`                    | yes — `vi.mock('x', f)` into `vi.mock(import('x'), f)`  |
| `vitest/prefer-lowercase-title`             | `fixable_fix`                    | yes — `'Hello'` into `'hello'`                          |
| `vitest/prefer-strict-boolean-matchers`     | `fixable_fix`                    | yes — `toBeTruthy()` into `toBe(true)`                  |

So the toolchain keeps its own switch. A mark on a rule with no fixer, or on one oxlint already keeps behind `--fix-dangerously`, would say something false, and this package's own suite refuses it ([Test](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md#the-rulebook-has-seven-suites)).

The switch is a wrapper config around the one the linter runs with — the project's own, or the default where it keeps none — that the pass writes beside that config and deletes after the run. It goes there and nowhere else, because oxlint resolves `ignorePatterns` and override globs against the directory its config sits in — and every run IGNORES the wrapper's name, so no diagnostic ever names a path the operator cannot open and no tree can ever clear.

That wrapper also stops the run reporting UNUSED DIRECTIVES. Every profile ships `reportUnusedDisableDirectives`, and a run that has just turned eleven rules off cannot judge a directive naming one of them — the rule is off for that run alone, and the directive would be called dead on evidence the wrapper itself created. An unused directive is reported by the check-shaped run made after the fixer, where the consumer's own rules are armed again, and by `check`.

For the same reason the wrapped runs never keep what they write to `.jterrazz/oxlint-suppressions.json`. oxlint rewrites that file on every `--fix` run, dropping each entry whose rule the run did not report — and a wrapped run has eleven rules off. The pass puts the file back as it was after the fixers, and the prune that follows reads it with every rule armed. `@jterrazz/test`'s own fixes, whose wrapper arms the plugin alone, do the same.

### A wrapper fix mode cannot write

Where the wrapper cannot be written — a directory beside the config the run may not write to — no oxlint fix runs at all. The pass prints a four-part refusal naming the write that failed and fails, rather than reading a fix that never ran as a green one, and removes every wrapper it had already written beside another config.

### A nested config fixes its own subtree

The fixer runs once per config scope. A wrapper is handed to oxlint with `-c`, and `-c` turns NESTED config discovery off for that run — so a project whose root config has a `sub/oxlint.config.*` beneath it gets one wrapped run for the files that config governs, and one for the rest. Each file is rewritten by the config `check` lints it by: the closest one above it.

It is one run per scope, not one config with the subtree folded in as an override, because oxlint's nested config REPLACES the root's rules in its subtree rather than extending them. An override can only add to what the root arms; it cannot take back a root rule the subtree never names.

A project with no config of its own is one scope. `check` hands the default with `-c` as well, so neither run reads a nested config there.

### A warning is a diagnostic

oxlint leaves its exit code at 0 for a warn-severity diagnostic, and a pass that passed prints no log — so `check` would be silent on a tree `fix` failed. The run passes `--deny-warnings`: every diagnostic the linter reports is printed and judged, whatever severity armed it.

There is no warn tier, in this rulebook or in `@jterrazz/test`'s: a rule is on at `error`, its debt held by the ratchet, or off with a recorded reason. oxlint's suppressions hold errors alone, so a warning is a diagnostic nothing can hold down — a JS plugin composed beside the rulebook that still ships one fails the pass on it, and the pass says so in four parts beneath oxlint's report: its fix is to promote the rule to `error`, which the ratchet can then hold.

### The two rewriters run in order

Every pass of `check` runs in parallel, and `fix` keeps that — except for the two passes that WRITE. `oxlint --fix` and `oxfmt` rewrite the same files, so in parallel whichever finishes second lands its own copy over the other's work, and the `check` that follows fails on what the fix had just settled. In fix mode they run one after the other, the linter first; every read-only pass still runs beside them.

## The Oxfmt pass

The formatter is handed the same sweep, whole rather than cut to the shapes a linter parses, and it skips a file it has no parser for. A project with no formatter config of its own — `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts` or `.mts` — is handed the preset by path, for the linter's reason, and the sweep leaves out what the preset's ignores name. So it judges neither the ground a test stands on nor a path git ignores, and that holds whether or not the project carries an `oxfmt.config.ts` whose ignores would say so. `fix` writes through the same list: it formats a new file before `git add`, and never reformats the ground or an ignored path. The preset's own ignores — `public/`, `assets/` and the rest — still apply on top.

## The ratchet

A project adopting a stricter rulebook has two honest options: burn every diagnostic down before the first green run, or record where it stands and refuse to go backwards. The toolchain takes the second, and the lint debt is oxlint's own to hold: `.jterrazz/oxlint-suppressions.json`, one tracked file, counts every recorded diagnostic file by file and rule by rule, in oxlint's own format. oxlint reads that file only as `oxlint-suppressions.json` at the root, and takes no path for it, so `check`, `fix` and `baseline` stage the ledger there for the length of a run and move it back after, pruned or written; an editor's oxlint ignores the file either way, so the debt the ledger holds still shows in the editor. A file's count held exactly is suppressed; one past it fails the run, with each of that rule's diagnostics in the file listed; an entry the tree has paid down fails it too — the count is exact both ways, so the file shrinks the day the debt falls, and no slack is left for new debt to grow back into. oxlint judges only the files it lints, so an entry for a file that is gone — deleted or moved — is the pass's own to find, and it fails the run the same way.

oxlint's help names `oxlint --suppress-all` and `oxlint --prune-suppressions`, which would lint with another config, without types, and a bare tree. The pass adds the toolchain's word after oxlint's:

```text
found: a diagnostic .jterrazz/oxlint-suppressions.json does not hold — each one is listed above · why: … · fix: fix it, or run 'typescript baseline' to record where the project stands — never a bare `oxlint --suppress-all`, which lints with another config · read: docs/reference/quality-checks.md#the-ratchet
found: .jterrazz/oxlint-suppressions.json holds more than the project has left · why: … · fix: run 'typescript fix', which prunes the file · read: docs/reference/quality-checks.md#the-ratchet
found: .jterrazz/oxlint-suppressions.json holds entries for files that are gone: src/moved.ts · why: … · fix: run 'typescript fix', which prunes the file · read: docs/reference/quality-checks.md#the-ratchet
```

The flags that write the file are not in oxlint's `--help` yet; the toolchain pins oxlint to one exact version, and its specs run each one.

### What `.jterrazz/baseline.json` still holds

`.jterrazz/baseline.json` holds what no linter judges — one section per preset, each named by the preset that owns it, `{ "typescript": { … }, "test": { … } }` — read, written and judged by one engine, the kit's ([Rules kit](rules-kit.md#the-ratchet-engine)), which keeps every section but the one it writes byte for byte. The `typescript` section holds the Architecture (layer map) pass's `architecture/<name>` entries ([its section](#the-architecture-layer-map-pass)) and the Names (tree) pass's `names/*` entries ([its section](#the-names-tree-pass)), each judged by its own pass, exactly, with the same four refusals, each printed in four parts under `baseline-ratchet`: a count above its entry, a rule with findings and no entry, a count below its entry, an entry at zero. Each finding prints at its position in the compiler's convention, `src/types.ts:1:1: error names(no-language-construct-name): found: … · why: … · fix: … · read: …`, and a pass whose findings the section records no entry of adds one lesson after them, naming `typescript baseline` as the gesture that records where the project stands. The `test` sections are `@jterrazz/test`'s — its checker passes' counts — which that package writes and judges.

An oxlint rule left in the `typescript` section — one recorded before oxlint held its own — is refused in the Oxlint pass under `baseline-moved-to-oxlint`, in four parts, naming `typescript baseline`, which records it in `.jterrazz/oxlint-suppressions.json` and drops the entry. `baseline-unreadable` refuses a `.jterrazz/baseline.json` that is not JSON, or that holds a top-level key whose value is not a section of counts.

`fix` lowers what FELL and never records what grew: it prunes `.jterrazz/oxlint-suppressions.json` — the file goes when nothing is left in it — and the Architecture and Names passes re-record their own falls, each named in its pass (`re-recorded .jterrazz/baseline.json › typescript › <rule> <was> → <now>`). Debt that grew is written only by `typescript baseline`, by hand.

### Recording it

```bash
typescript baseline
```

A command of its own, because it neither checks nor repairs: it writes down where the project actually stands, debt that grew included. `fix --baseline` would bury that rewrite inside the gesture a developer runs twenty times a day; `fix` records only the falls, which can make the files shrink and never let them grow. It records the lint debt with oxlint — `--suppress-all`, then `--prune-suppressions`, with the config and the sweep `check` lints by, types included — and writes the `typescript` section from the Architecture and Names passes, then hands both files to the project's own oxfmt: they are tracked like any other file, so the formatter owns their shape. The `test` section is recorded by `@jterrazz/test`'s own command, never by this one. A file this command cannot read as sections is refused rather than rewritten; so is a run whose Architecture (layer map) or Names (tree) pass wrote no report — a pass that could not judge the tree, dependency-cruiser refusing to run included, writes none: that side of the section is unknown, and writing it would erase that debt rather than record it — `typescript check` prints why the pass died. A sweep that refused an answer records no lint debt either, rather than recording the directory.

## The Publish (packaging) pass

This pass refuses a tarball the repository cannot see is broken. A packaging mistake is fatal in the registry: an `exports` entry pointing at a file nobody built, a subpath left out of `files` so it resolves in development and 404s in a consumer, a type declaration a modern resolver cannot see. [The build guard](#the-build-guard) refuses a build that compiles in test material, which works in the registry and ships what no product runs.

It runs once per unit — the root, and each workspace member — that declares a kind npm publishes, a `library` or a `cli`, and whose manifest is not `private` ([Configuration](configuration.md#kind-and-platform)). A private one, an application, a workspace root that only holds members, and a project that declares nothing have no tarball to be judged on.

<!-- GENERATED:findings publish -->

| Rule                                 | Requirement                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `publish/export-target-exists`       | Every target the exports, main and types fields name exists on disk.        |
| `publish/export-covered-by-files`    | Every target the exports, main and types fields name is published by files. |
| `publish/build-succeeds`             | The build the guard reads succeeds.                                         |
| `publish/no-test-code-in-production` | No shipped file is compiled from test material.                             |

<!-- /GENERATED:findings publish -->

Beside them run `publint --strict` on the packed tarball and `attw --pack . --profile esm-only` on the declarations, and each prints its own report verbatim when it refuses. A package that publishes only a `bin` gets no attw: it offers an importer nothing to resolve.

The first two rule ids overlap publint on purpose. They read the SOURCE TREE and it reads the TARBALL, which means they answer where npm is not reachable and they keep a stable id whatever publint's wording does next. A gate's vocabulary is its own.

**Both tools are dependencies of this package rather than tsdown flags.** tsdown 0.23 can run them behind `--publint` and `--attw`, but only during a build — and `check` has to judge a package that does not build, which is exactly what this one is.

### The build guard

A published build never carries test material, and `publish/no-test-code-in-production` refuses one that does. The pass builds the package as it builds — the plan `typescript build` derives from its manifest — and reads each chunk's module ids off a `generateBundle` hook.

That build IS `typescript build`'s: the same plan, from the entries [entry-points.ts](https://github.com/jterrazz/package-typescript/blob/main/lint/kit/project/entry-points.ts) reads off the map. Each chunk is named as the build writes it, `.js` and `.cjs`, so `files` is asked about the path the tarball holds.

That build leaves the disk alone: no chunk is written.

A file `files` ships — read as npm reads it, where a later `!` entry takes back what an earlier one gave — is judged on three counts:

- a module of the package's own compiled into it, when `materialAt` names it — a `*.fixtures.ts`, a test file, ground, the specs tree, a contract;
- an installed module compiled into it, when `testPackageOf` names its package — bundling `vitest` is never meant;
- a specifier it leaves external, when `testPackageOf` names it and the package declares it neither in `dependencies` nor in `peerDependencies` — a test tool ships its runtime on purpose.

That exemption differs from the one `no-test-code-in-production` grants, and on purpose: a package declaring a test tool in `dependencies` or `peerDependencies` states that its tarball carries that runtime, while `test.production.allow` in `@jterrazz/test`'s section of `jterrazz.config.ts` excuses a source import a product makes at run time, with its reason.

What test material IS is `@jterrazz/test`'s alone: the two readers are the ones its `no-test-code-in-production` rule judges by, published on its `./oxlint` entry, and the pass loads them rather than keeping a copy. The finding states itself in four parts and sends its reader to the `no-test-code-in-production` row, where the definition lives.

The readers come from the install the package resolves, found by the walk [test-package.ts](https://github.com/jterrazz/package-typescript/blob/main/lint/kit/project/test-package.ts) keeps, and from nowhere else. The toolchain's own `@jterrazz/test` is never asked: it is the toolchain's dependency, not the package's, and it would judge a package by a definition the package never chose.

A package with a build that resolves none has nothing to judge. The pass says so in one line, `publish/no-test-code-in-production: nothing to judge`, with the reason and, for a workspace member, `in <member>` — and builds all the same, so a build that fails still fails the pass. An install whose `./oxlint` entry is missing, exports no reader or throws on import is named for that, with the first line of what went wrong. A package with no build — no config of its own and no target under `dist/`, like this package — hears nothing: there is no build to judge, and none to fail.

A build that fails is a finding too. `publish/build-succeeds` names tsdown's first error in the same four parts, and the pass carries on to publint and attw, so one run still says everything else it knows.

## The Architecture (layer map) pass

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) holds the module graph to a layer map. It resolves every import the way the build does — the tsconfig's paths, a package's `exports`, an index file, a relative `../` — so an edge is judged by where it lands, never by how its specifier is spelled; oxlint's `no-restricted-imports` could only read the text. The pass runs where a map is declared — by a preset, the library kind's `lint/` direction included, or by the project — or where the tree is laid out as a hexagonal application, and nowhere else: a project with no architecture is not in breach of one.

A map is declared in `jterrazz.config.ts`, under `typescript.architecture`:

```ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: {
        architecture: {
            hexagonal: true,

            layers: [
                {
                    name: 'handlers-reach-services',
                    from: { path: '^src/handlers/' },
                    to: { path: '^src/store/' },

                    why: 'a handler speaks HTTP and hands the work to a service',
                    fix: 'read the order through the service, which owns the store',
                    read: 'docs/concepts/architecture.md#layers',
                },
            ],
        },
    },
});
```

A layer is dependency-cruiser's own vocabulary — `from` and `to`, with `path`, `pathNot`, a `$1` naming a group the `from` path captured — plus the three parts of what a refusal teaches: `why`, `fix`, and the `read` a reader opens next. Each violation prints at its import, in four parts, under the id `architecture/<name>`:

```text
src/handlers/orders.ts:2:24: error architecture(handlers-reach-services): found: `src/handlers/orders.ts` imports `src/store/orders.ts` · why: … · fix: … · read: docs/concepts/architecture.md#layers
```

A project that already keeps a `.dependency-cruiser.cjs`, `.js` or `.mjs` at its root has it extended, not replaced: its own rules run beside the declared ones, and a violation of one prints its `comment` as the why. A cruise starts from every top-level folder the sweep holds a source file in — never a dot-folder, never the ground a spec stands on, which the cruise skips at any depth — so a map judges `app/domain/` as it judges `src/domain/`. A declared map with no such folder to cruise fails the pass in four parts: its silence would read as every boundary kept. The pass is launched wherever a `jterrazz.config.ts` or a dependency-cruiser config exists, or `src/` holds `domain/`, `application/` and `infrastructure/`, and resolves the settings itself, so a map written by shorthand, a spread or an imported object is judged like one written in place. A layer whose `from` names no file of the project is dropped before the cruise: a library's laws cost one without a `lint/` tree nothing. A map the pass cannot read, such as a `jterrazz.config.ts` that does not load or a layer missing one of its six parts, fails the pass in four parts, and so does a dependency-cruiser that cannot run or that stops with no report.

A project that adopts a map its tree already crosses records the crossings with `typescript baseline`: each `architecture/<name>` count goes into `.jterrazz/baseline.json › typescript` and is held exactly, like every count of [the ratchet](#what-jterrazzbaselinejson-still-holds), so a new crossing fails the run and a paid one is re-recorded by `typescript fix`.

A package that ships layers for its consumers hands them in its preset, and a project declaring the preset is held to them beside its own: [Configuration § Presets](configuration.md#presets).

### The hexagonal map

`hexagonal: true` adds the map this package ships, eight boundaries whose arrow points inward. A tree laid out as a hexagonal application — `src/` holding `domain/`, `application/` and `infrastructure/` — is held to it without writing it, and `typescript doctor` shows it `derived from the tree`; one that is not hexagonal for all that writes `hexagonal: false`:

- `domain/` imports no other layer.
- `application/use-cases/` and `application/ports/` reach the domain and the ports, never an implementation.
- `composition/` is the one layer that imports `infrastructure/`: no other layer does, the specs aside.
- `composition/` is imported by the app's entry and by a `specs/**/*.specification.ts` runner, and by nothing else. The entry is the declared platform's: `src/index` for `node` and `bun` — and for a project that declares no platform — the root layout `app/_layout` for `expo`, `app/layout` or `pages/_app` for `next`, `src/main` or `src/index` for `react`, and `src/middleware` for `astro`, each also under `src/` where the framework allows it.
- `infrastructure/inbound/` reaches an outbound adapter through injection, not by import.
- `presentation/ui/atoms/` and `molecules/` stay clear of navigation.
- `presentation/features/<feature>/` reaches no other feature, except `features/common/`.

Why the two `composition/` boundaries hold, and how the entry and a runner build the app through it, are [The composition root](../concepts/the-composition-root.md)'s. Each folder matches at any depth, so a workspace member's `src/domain/` is held like the root's. The eight are `hexagonalRules(platform)` in `lint/consumer/checks/architecture.hexagonal.ts`, each with its why and its fix, the entries by platform its `COMPOSITION_ENTRIES`.

### What the pass needs from the tree

`dependency-cruiser` declares a `typescript <7` peer, and this tree satisfies it: the ordinary `typescript` dependency here is the ^6 JavaScript compiler API that perfectionist already needs ([Architecture](../concepts/architecture.md)). That is also why the TS7 Go compiler stays out of `node_modules` under the name `typescript`.

The cruise leaves out the ground a test stands on and `.artifacts/`, the output of a run: a `make check` writes there while the pass reads, and a module that vanishes between two reads would be an ENOENT, never a finding.

## The Astro (check + format) pass

`.astro` is the one file shape oxfmt does not parse, and `astro check` is the only checker that reads a template's frontmatter. So in every unit that declares the `astro` platform — the root, or a workspace member — the pass runs both there: the unit's own `astro check`, and `prettier` over every `.astro` file under it.

`astro check` reads the templates alone: it is handed a tsconfig, derived into `.artifacts/astro/`, that extends the unit's own and whose root files are its `.astro` files, so a template still type-checks against the modules it imports while a module's own error is reported once, by the TypeScript Check pass, never twice. Both passes read the module types `astro sync` writes into `.astro/` — `astro:content`, `astro:middleware` — which git ignores and a fresh clone lacks, so in every such unit `astro sync` runs once per run, before either reads them, and a failed sync fails both with its report. The Knip pass is handed, as entries, the local modules the unit's Astro config loads by an `entrypoint` path — an image service, a renderer — which knip's Astro plugin does not read.

**`prettier` and `prettier-plugin-astro` are dependencies of THIS package**, with a config derived from the oxfmt values — 100 columns, 4 spaces, single quotes, trailing commas everywhere.

The plugin is handed to prettier as a resolved path rather than as a name in the config, because prettier resolves a plugin name from the working directory — and the working directory is the consumer's, which is precisely the project that no longer declares it.

Both halves run in `fix` too: prettier writes, `astro check` is read-only wherever it runs. The pass speaks on success in fix mode alone, because there it rewrote files the operator owns.

## The drift report

Not a pass: a report, printed at the end of every `check`. Four numbers, because the alternative is what the estate had — twenty-eight repositories each quietly a little further from the shared rulebook, and nobody able to say by how much without opening twenty-eight config files.

```text
 DRIFT  Deviations from the profile

  declared                              api on node
  exceptions                            4
  rules off vs profile                  1 (no-console)
  suppressions                          2
  .jterrazz/oxlint-suppressions.json    nothing held
  .jterrazz/baseline.json › typescript  7
  .jterrazz/baseline.json › test        3
  tool versions                         in range
```

A rule set apart, a suppression written, a baseline entry recorded and a tool left behind are the four ways a project drifts — and a preset's law set aside, the fifth, printed as `laws set aside` with each law's name wherever the project keeps one under `optOuts` ([Configuration](configuration.md#setting-a-law-aside)). The baseline is named by every section the file keeps — `typescript` always, each other only where the project keeps it — because a count with no section beside it says nothing about which debt it is. A section absent, or holding no entry, reads `nothing held` — the Oxlint pass's words for the same state, so one state has one word. A file the Oxlint pass refuses as `baseline-unreadable` reads `unreadable`: it was never read, so it holds no count the row may claim, not even none. `typescript check --json` prints the same reading for a machine — the block under the `DRIFT` header becomes one JSON object, every pass above it still prints for a human — which is how a fleet-wide sweep collects the table. Its `baseline` is the `typescript` section's total, `null` where the file does not keep it, or `"unreadable"`; `sections` maps every other section the file keeps to its total; `optOuts` lists each law set aside with its reason. Where a person reads `nothing held`, the machine keeps an absent section (`null`, or no key in `sections`) apart from an emptied one (`0`), because a sweep counting who adopted the ratchet needs the difference.

**The profile is the declared platform's, and what is off is read from the project's own file.** `declared` names the kind and the platform, or says the project declares nothing and is measured on `node`; `exceptions` counts every setting `jterrazz.config.ts` writes with its reason — a `reason` beside it, or a name mapped to one — in every section, its standard's defaults never among them ([Configuration](configuration.md#the-typescript-section)); `rules off vs profile` counts the rules its `typescript.oxlint` turns off, each of which already carries its reason there ([Configuration](configuration.md#the-lint-rules)), so the report names them and refuses nothing. `--json` prints the declaration as `declaration`, `null` where there is none, the count as `exceptions`, and the rules as `rulesOff`. A project that holds `Stryker disable` directives prints them beside its suppressions — `suppressions  2 + 23 mutation directives`, `mutationDirectives` in the JSON — since each declares mutants no test can tell apart, which a lint count alone would hide. A workspace root prints each member that holds exceptions on a line of its own under `exceptions`, and the row is their sum with the root's own, every member in `members` of the JSON: a root that reads `exceptions 0` over a member holding three says nothing about the repository. The last mutation run's browser-side mutants no test ran — the ones the verdict prints as `unmeasured`, never folded into detected — print as `unmeasured  120 mutants (browser-side)`, under a workspace root with each member that holds some on a line of its own, `unmeasuredMutants` and `unmeasuredByMember` in the JSON; the row is absent where the report holds none or no run left one.

The versions line reports only what deviates. The full table is `typescript doctor`'s, and printing it on every run would put a number that changes with every dependency bump in front of a reader looking for what changed in their own tree.

## The Suppressions (directives) pass

Every place the project told a checker to look away. A suppression is a decision, and a decision the next reader cannot re-derive is a defect waiting to be re-introduced, so four rules hold what oxlint and Stryker do not.

<!-- GENERATED:findings suppressions -->

| Rule                                        | Requirement                                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suppressions/spelled-for-this-toolchain`   | A suppression is spelled for the linter this toolchain runs: oxlint-disable, never eslint-disable or biome-ignore.                                        |
| `suppressions/states-its-reason`            | Every oxlint-disable and Stryker disable directive states the reason it exists.                                                                           |
| `suppressions/stryker-names-its-mutators`   | A Stryker disable directive names the mutators it declares equivalent, never all of them.                                                                 |
| `suppressions/stryker-attaches-to-a-mutant` | A Stryker next-line directive stands where a mutant starts on the next line: never above a line led by a closing brace, never in a JSX comment container. |

<!-- /GENERATED:findings suppressions -->

A directive names the rule it silences, then `--` and the reason, on the line above the code it covers — `oxlint-disable-line` puts it at the end of that line instead:

```ts
export function announce(message: string): void {
    // oxlint-disable-next-line eslint/no-console -- the command's one line of output
    console.log(message);
}
```

Turning a rule off for the whole project is `typescript.oxlint`'s, with its reason ([Configuration § The lint rules](configuration.md#the-lint-rules)).

A mutation directive is a suppression too, read the same way: `// Stryker disable next-line ConditionalExpression: <why no test can tell it apart>`, its reason after the colon, its mutators named — never `all` ([The mutation verdict](#mutation)).

A directive is read only where a checker reads one: at the OPENING of a comment. Prose about a suppression, and a string carrying its spelling — the gate's own source is made of both — is not a suppression, and neither oxlint nor tsc would treat it as one.

A directive that suppresses nothing is oxlint's to refuse, not this pass's: every profile ships `reportUnusedDisableDirectives` at `error`, so the Oxlint pass reports each one as an `Unused oxlint-disable directive`. That covers more than the gate could: a rule the config leaves off, a live rule that no longer fires on the next line, a JS plugin's rule, and a plugin rule that no longer exists. The pass keeps only what oxlint does not judge — the spelling of a lint directive and the reason it states. A TypeScript directive is oxlint's too: the rulebook arms `typescript/ban-ts-comment`, which refuses a `@ts-ignore` and a `@ts-expect-error` with no description, so the pass reports neither a second time and only rewrites the first in `fix`.

### What `typescript fix` rewrites

Two spellings, both mechanical. An `eslint-disable*` becomes `oxlint-disable*` when every rule it names is one this project runs, read off `oxlint --print-config` per file, overrides included — a name that means nothing here is a directive whose intent only its author knows. A `@ts-ignore` becomes `@ts-expect-error`, which is the same suppression plus a failure when the error it was covering is gone.

It never invents a reason, and it never deletes a directive: both are the author's judgement, and a rewrite that guessed either would be worse than the report.

## The Markdown (prose) pass

Every `*.md` git does not ignore, outside the ground a test stands on — a `__fixtures__/`, `__expected__/`, `__seeds__/` or `__requests__/` folder wherever it sits, another project's tree — is read twice: by [rumdl](https://rumdl.dev), for what Markdown itself defines, and by the prose gate, for what the estate adds.

The pass judges the manual, never content: a page the formatter keeps byte for byte is a page the pass neither judges nor rewrites. That is a content tree — `assets/`, `public/`, `dist/`, `.next/`, `.expo/` — whose pages a site serves or signs as written, a root declared verbatim (`typescript.roots`), and a path the settings hand the formatter to leave alone (`typescript.oxfmt.ignore`), in the root and in every workspace member alike. One `typescript fix` once reformatted 36 signed articles under a website's `assets/`, and every proof of them broke with the bytes; a page there reads as its author wrote it, whatever rumdl would say of it.

### What rumdl judges

rumdl is the Markdown linter; the pass hands it the pages and prints its own lines, each at its position — `README.md:5:80: [MD051] Link anchor '#usage' does not exist in document headings`. A link to a heading the page does not have is its MD051, a fence with no language its MD040. A relative link to a missing file is its MD057, which the pass runs apart and reports as `markdown/link-resolves` (below), so that git can be asked about the target. A page whose frontmatter names it — `name:` on an agent or a skill page, `title:` elsewhere — is titled by it, so MD041 asks no `#` heading of it. It runs on `src/presets/rumdl/rumdl.toml` unless the project keeps a `.rumdl.toml` of its own, and that preset turns off the rules that judge layout — list indents and markers, line width — because oxfmt writes the layout of a page and two owners of one line would fight. Inline HTML is a form the chapters use (`<details>`), so MD033 is off too. `typescript fix` runs rumdl's own fixes; what it cannot fix stays a finding.

rumdl reads the disk and nothing else, so the check never touches the network. A remote link is not judged here: lychee, the dead-link checker, would need the network, which `make check` never uses, and it ships no npm package to install it with — rumdl's MD057 and MD051 are the offline check of every local link and anchor. A repository that wants its remote links read runs lychee itself, opt-in, where the machine has it: this one's `make check-links` ([Develop](../guides/develop.md#the-loop)). A link into a tree git ignores — a clone on the workstation's bench, a build product under `dist/` — is forgiven, exactly as a backticked path there is: the two rules judge one fact, and a verdict that turns on what a machine happens to hold (green in the checkout that built the tree, red in a worktree or in CI) is no verdict. A link to nothing, ignored or not, is still refused.

### What the prose gate adds

The prose gate reads what no Markdown linter knows: whether a backticked coordinate resolves, whether a skill names a page its package ships, and whether a page's blocks breathe. It leaves two things to their owners: a region between `<!-- GENERATED:name -->` and `<!-- /GENERATED:name -->` is written by the program that owns it, and a page named by a code span qualified with another repository's name (`` `package-typescript` `docs/reference/quality-checks.md` ``) is that repository's to resolve.

<!-- GENERATED:findings markdown -->

| Rule                                    | Requirement                                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown/path-resolves`                | Every backticked repository path of a page names something on disk or in a tree git ignores, but in a decision record, which names the paths of its day. |
| `markdown/link-resolves`                | Every relative link of a page reaches a file on disk or a tree git ignores.                                                                              |
| `markdown/skill-links-its-references`   | A skill's SKILL.md links every page of its references/ folder, since a reference nothing points to is one no agent opens.                                |
| `markdown/page-reference-resolves`      | Every page a skill names is one its package ships.                                                                                                       |
| `markdown/prose-block-is-short`         | A paragraph or a list item runs twelve lines at most.                                                                                                    |
| `markdown/fenced-run-is-short`          | A fenced block breathes within fifteen lines.                                                                                                            |
| `markdown/long-section-has-subheadings` | A section over thirty prose lines is broken by a subheading or a list.                                                                                   |

<!-- /GENERATED:findings markdown -->

A decision record is `docs/decisions/` of the manual, or a numbered `decisions/NNN-<title>.md` anywhere — a brand's seat keeps its own, frozen the same way.

A skill is read from the install, where nothing can correct it, so one more rule reads a page under `skills/` alone: `markdown/page-reference-resolves` refuses a `docs/<section>/<page>.md` it names that its package does not ship. The page is resolved beside the skill's own `skills/` folder, the package root it is published from. A skill's `references/*.md` are disclosed step by step, and `markdown/skill-links-its-references` refuses one its `SKILL.md` links from no line: an agent opens a reference only where the skill points to it.

The three numbers are the readability floor of the shared doctrine, not the craft it asks for: the gap between them is a reader's pass, not a red gate. They are named constants at the top of the gate, and no page keeps a second copy of them.

The backtick rule reads a closed roster of opening segments — `apps/`, `bin/`, `lib/`, `lint/`, `packages/`, `presets/`, `specs/`, `tests/` — because without one every `a/b` in a sentence would be read as a coordinate. `docs/` and `src/` are deliberately off it: every repository has both, so a page teaching a convention writes `src/index.ts` about the READER's tree, not about its own. A relative LINK into either is still judged — by rumdl — because that one names a real target.

A path of somebody ELSE's tree — a library's chapter showing where the thing it ships lands in a consumer — is shown in a code fence, never in backticked prose. The rule reads a backticked coordinate as this repository's own and is right to: the alternative is an allow-list, and the first path that stops existing is the one nobody notices. A fenced block is exempt, so the example that teaches a consumer stays exactly where a reader wants it.

## The Names (tree) pass

What a project calls its own parts, swept under the roots where a project keeps what it wrote: `apps/`, `bin/`, `lib/`, `lint/`, `packages/`, `specs/`, `src/`, `tests/`. Each root's OWN name is the toolchain's vocabulary rather than the project's choice, so it is never judged — `lib/` sits on this list and on the grab-bag roster at once, and only what a project put inside it is the project's to name. A directory below an `app/` router root is a Next.js route segment — a URL the product serves, not a name the tree chose — and is not judged either; the files inside it still are.

<!-- GENERATED:findings names -->

| Rule                               | Requirement                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `names/no-grab-bag-name`           | A directory or file is named for the subject it holds, never a grab-bag word.                                                  |
| `names/no-language-construct-name` | A directory or file is named for its subject, never for a construct of the language.                                           |
| `names/no-abbreviated-word`        | Every word of a name is spelled whole.                                                                                         |
| `names/directory-in-kebab-case`    | A directory under a named root is written in kebab-case, a route segment in its framework's grammar.                           |
| `names/entry-follows-its-grammar`  | The source a published subpath is built from is named index[.<subpath>][.browser].ts, and a bin's <command>.bin.ts.            |
| `names/bin-is-published`           | A module named <command>.bin is the entry of a bin the package publishes under that command, or that entry's test.             |
| `names/index-is-an-entry`          | A module named index is the entry of a subpath the package publishes or of a private import it declares, or that entry's test. |
| `names/export-has-an-entry`        | Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.                   |

<!-- /GENERATED:findings names -->

All three rosters are closed, and the standard carries them ([Configuration](configuration.md#the-standard)): one executable copy, read by the gate from the resolved settings. Grab-bag: `base`, `common`, `helpers`, `lib`, `misc`, `stuff`, `tools`, `utils`. Construct: `constants`, `helper`, `interfaces`, `type`, `types`, `util`, and the `.types.ts` suffix — a word the grab-bag already refuses is reported once, under that roster. A leading `_` excuses no word of either roster: it states a position, not a subject, so `_utils/` is refused as `utils/` is. `shared` is no grab-bag word — it names a property a folder's files hold — but behind the `_` it restates the mark, which already says the row shares the folder, so in a code root `_shared/` is refused under the grab-bag rule, its fix asking for what the files share (`_taxonomy/`); under `specs/` it is `@jterrazz/test`'s closed-list rule's. Shortcut: `auth`, `cfg`, `impl`, `infra`, `k8s`, `pkg`, `repo`, `repos`, `svc`, `tmp` — and the `_` marker does NOT excuse one, since it states a position, not whether the name is whole. The one exemption is a subject: a folder on the path of a spec file (`.spec.ts`, `.spec.yaml`) below a specification folder of `specs/` — the specifications the `test` section names, `@jterrazz/test`'s standard — is a command, a route or a page the product named (a folder `auth` under the `cli` specification), and whether it is the spec's own subject is that package's `spec-in-subject-folder`. A `__` folder (`__setup__/`, `__fixtures__/`), a helper folder no spec stands under and everything below them is judged like any other.

A construct is judged on the WHOLE name: `type-registry.ts` names a subject and passes, `types.ts` names a part of the language and fails. Two words stay off the rosters though they sound generic, because each names a role a reader recognises at once: `setup` is what a runner loads before a test (`vitest.setup.ts`, a `setupFiles` entry), and `core` is the part of a layered tree every other layer depends on. An `index[.<subpath>][.browser].ts` is the entry of a subpath the package publishes ([the entry grammar](#the-entry-grammar)), and no roster holds it. The ground a spec stands on is never swept at all, so a fixture may be called anything its scenario needs.

### The entry grammar

A package that publishes a build names each entry for what it publishes, so the tree says which file a consumer's `import` lands on without the manifest open. The source a subpath is built from is `index[.<subpath>][.browser].ts`: `.` from `index.ts`, `./config` from `index.config.ts`, `./rules` under its `browser` condition from `index.rules.browser.ts`, a nested subpath with a dot for each slash. `node` is the default runtime, never a variant, so no entry is named `.node`. A bin the build compiles is `<command>.bin.ts`, named for the command a consumer types: `typescript` from `typescript.bin.ts`. A module the package's own code loads by path — a program it spawns, a plugin a tool loads — is a private entry: it is declared as a `#` import in the manifest's `imports`, `#checker` built from `index.checker.ts`, and named by the same grammar.

The pass reads the `exports`, `imports`, `main` and `bin` targets under the build's output folder, and maps each to its source through the mapping the build compiles by: each published target from its entry under `src/` or at the root of `lint/`, named by this grammar ([Building](building.md#the-entries)). A pattern subpath (`./tsconfig/*`) publishes a folder, not an entry, and a target outside the build that is not code (a JSON preset) is no compiled entry: neither is judged. In a package that publishes a build, a bin, or a `.js`, `.cjs` or `.mjs` module, published from outside it is code no source compiles, and is refused; a package that builds nothing publishes its JavaScript as written.

- `names/entry-follows-its-grammar` refuses an entry named otherwise, at the source.
- `names/index-is-an-entry` refuses a module under `src/` or `lint/` named `index` that builds nothing the package publishes — its test passes beside the entry it tests. A module that composes others for the package's own code is named for what it composes.
- `names/export-has-an-entry` refuses a published target the build compiles from no source it names, and, in a package that publishes a build, a bin or a module published from outside it.
- `names/bin-is-published` refuses a module under `src/` or `lint/` named `<command>.bin` that builds no bin the package publishes.

A package of the family states one more convention, which the gate does not read: a subpath that configures a tool is named for that tool's config file — `./config` is read by `jterrazz.config.ts`, `./oxlint` by `oxlint.config.ts`, `./vitest` by `vitest.config.ts` — so a consumer finds the import in the file named for it.

### What ls-lint judges, and what stays the gate's

Where a name sits is declarative, so [ls-lint](https://ls-lint.org) judges it: the pass writes an ls-lint config from the tree this page describes, runs it over the disk, and prints each failure as the rule below that owns it — every directory under a named root in kebab-case (`names/directory-in-kebab-case`), the closed folder lists and root files of [the lint tree](#the-lint-tree), and a skill holding nothing beside its `SKILL.md`. A `__<word>__` name is a special folder, and the list is closed: under `specs/`, `__setup__/` and the four ground folders; in a code root, `__tests__/` alone — any other is refused with the list in its message. A route segment keeps its framework's grammar — `[id]`, `[[...slug]]`, `(group)`, `@slot` — so a Next.js or Astro tree passes as written. The ground a test stands on — under a specs tree, or in a `__tests__/` —, `node_modules/`, `dist/` and every dot-folder are left out, and so is a root declared verbatim. ls-lint reads the disk, so its failures are read against the sweep the other rules judge: a path git ignores is never named, and a directory it refuses is named only when it holds a file git sees. A file ls-lint never looks at — one with no extension, such as a `README` or a `LICENSE`, or a dot-file — is judged by the gate itself wherever a folder is closed, at the root of `lint/`, of an audience folder, of `skills/` and of a skill, under the same rule ids.

What ls-lint cannot express stays the gate's, in its own code:

- the three rosters above — ls-lint's regular expressions have no negative lookahead, so "any name but these words" is not one it can write;
- the root spine and its declared roots, which read `package.json`, the build config and `jterrazz.config.ts`, and the entry grammar, which reads the first two;
- `names/audience-holds-only-declarations` and `names/rule-file-in-its-family-folder`, which read what a module exports and which family its catalogue row names;
- the six gestures of the `Makefile`, which read its text, and an empty directory, which ls-lint never sees.

### A name rule a project declares

A project names its own rules of where a name sits under `typescript.names`, in ls-lint's own vocabulary — `ls` maps a glob to the rules of what it matches, `ignore` lists the globs the rule never enters — plus the three parts of what a refusal teaches:

```ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: {
        names: [
            {
                name: 'module-in-kebab-case',
                ls: { src: { '.ts': 'kebab-case' } },

                why: 'one case for every module keeps a search to one spelling',
                fix: 'rename it in kebab-case',
                read: 'docs/naming.md#modules',
            },
        ],
    },
});
```

Each rule is one ls-lint run of its own, its globs read from the root of every unit — the project and each workspace member — so two rules never share a glob, and a failure is known to be its rule's without a pattern matched back. ls-lint reports a count at a directory for an `exists` rule, and the pass names each file the failed key covers instead: an exact extension (`.spec.ts`) where the rule writes one, a wildcard key (`.*`, `.*.spec.ts`) for the files no exact key covers. A failure prints at the file, or at the directory ending in `/`, as `names/<name>`, in four parts:

```text
src/orderLine.ts:1:1: error names(module-in-kebab-case): found: `src/orderLine.ts` breaks ls-lint's `.ts: kebabcase` · why: … · fix: … · read: docs/naming.md#modules
```

Three limits are ls-lint's, and a rule is written around them. Its extension is everything after a name's first dot, so `a.b.spec.ts` carries `.b.spec.ts`: a rule about every spec writes `.spec.ts` and `.*.spec.ts`. It never judges a file at the root it runs from, so a rule about a unit's root files is not one ls-lint can hold. And it anchors a `regex:` as written, `^` before it and `$` after, so an alternation is wrapped in a group — `regex:(?:index|main)` — or its first branch is held only at the start and its last only at the end. Within one rule, two globs matching the same directory are judged in no stable order, so a rule's globs never overlap. A rule the pass cannot read — a `name` not in kebab-case, an `ls` that does not map each glob to its rules, a missing lesson part — is refused as `names/jterrazz-config-loads`, and a glob ls-lint cannot read fails the pass in four parts. A package's name rules arrive the same way through its preset ([Configuration § Presets](configuration.md#presets)).

### The root spine

The **root spine** is the folders a repository root holds, the same in every repository: `src/` the product's code, `lint/` the lint rules a package ships, `specs/` the specifications, `docs/` the manual, `skills/` one short page per skill — and `apps/` or `packages/` where a workspace keeps its members, each a spine of its own. What the tree calls a root is therefore judged too. The table holds the whole `tree` family: the spine's rules, and those of [the lint tree](#the-lint-tree) and [an empty directory](#an-empty-directory) below. The family names what a rule judges; the prefix names the pass that prints it, and the Names pass prints both families, so a `tree` rule reads `names/…` like a `names` one.

<!-- GENERATED:findings tree -->

| Rule                                     | Requirement                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `names/no-undeclared-root-folder`        | Every root folder is on the root spine, imposed by a tool, or declared with its reason.                                                               |
| `names/declared-root-states-its-reason`  | A root declared in typescript.roots states why the repository keeps it.                                                                               |
| `names/declared-root-is-first-level`     | A root declared in typescript.roots is a first-level folder that is no folder of the spine.                                                           |
| `names/declared-root-holds-files`        | A root declared in typescript.roots holds a file git does not ignore.                                                                                 |
| `names/jterrazz-config-loads`            | The settings file jterrazz.config.ts loads, and its typescript section has the declared shape.                                                        |
| `names/skill-holds-only-skill-md`        | A skill is one skills/<skill>/SKILL.md and the references/*.md pages it links, and nothing else beside it.                                            |
| `names/repository-has-makefile`          | Every repository root carries a Makefile.                                                                                                             |
| `names/makefile-answers-every-gesture`   | The Makefile writes a rule for each of the six gestures.                                                                                              |
| `names/no-empty-directory`               | No directory of the working copy is empty.                                                                                                            |
| `names/lint-root-holds-only-entries`     | The root of lint/ holds its entries alone, each index[.<name>].ts built as a published subpath or a private import.                                   |
| `names/lint-folder-is-known`             | Every folder of lint/ is one of consumer, self and kit.                                                                                               |
| `names/consumer-folder-is-known`         | Every folder of lint/consumer/ is one of catalogue, rulebook, rules and checks, and no file sits at its root.                                         |
| `names/self-folder-is-known`             | Every folder of lint/self/ is one of catalogue, rules, checks and corpus, and only the modules composing them sit at its root.                        |
| `names/kit-folder-is-known`              | Every folder of lint/kit/ is one of project, baseline, checker, catalogue, compiler and testing, and no file sits at its root.                        |
| `names/audience-holds-only-declarations` | A module under lint/consumer/ or lint/self/ is a declaration: it runs as no program, and hands another module no function but one named for its file. |
| `names/rule-file-in-its-family-folder`   | A rule file sits under rules/<family>/, the family its catalogue row declares.                                                                        |

<!-- /GENERATED:findings tree -->

A skill is hand-written and read from the install, so anything beside its page — a file or a folder — is a second copy of a page or a projection of something the package already owns, bar one: a long skill discloses its detail in steps, and the `references/<topic>.md` pages its `SKILL.md` links are part of it, an agent loading each when it needs it. A `.md` page is all `references/` holds. A dot-folder (`.github/`, `.vscode/`) is the tools', never the spine's, and is not judged.

`lint/` stands on the spine only where the package SHIPS it, and it ships it one of two ways. Directly: an entry of its `package.json`'s `files`, or a target of its `exports`, reaches into `lint/`. Or through its build: a target the build compiles from a `lint/` source ([Building](building.md#the-entries)) is published by an `exports`, `bin` or `main` target, or by a `files` entry no later `!` entry takes back. A package that ships its rules as `dist/oxlint.js`, built from its `./oxlint` entry under `lint/` ([the entry grammar](#the-entry-grammar)), is the case the second way exists for.

A `lint/` nothing publishes holds rules no consumer receives — `src/` under another name — and is refused as `names/no-undeclared-root-folder`. The build config is read as text, never run: an entry is named for its key, `oxlint: 'lint/index.oxlint.ts'`, or for its file where it has none.

A workspace member is a spine of its own, judged the same way from its own folder: its first-level folders owe the spine, its `lint/` answers to its own `files`, `exports` and build, and it declares the roots it keeps beyond the spine in its own `jterrazz.config.ts`. The `Makefile` stays the repository root's.

The member named `specs` is the exception: it is the specs tree itself, a suite no kind owns, and its first-level folders are specifications and special folders that `@jterrazz/test` names, so none of them is a root beside the spine.

#### The six gestures

Every repository answers the same six at its root, whatever the language under it: `make install`, `make build`, `make lint`, `make fix`, `make test` and `make check`. The flows speak only these, so a session that has never opened the repository still knows how to install, prove and repair it. What each recipe runs is the repository's, save how `fix` meets a failure; that the rule exists is the contract. A target beyond the six — the `mutation` that [Getting started](../start/getting-started.md#4-answer-the-six-gestures-in-a-makefile)'s `check` runs — is a helper of a recipe, and no gesture.

`make install` installs the checkout's dependencies and touches nothing outside it: no global tool, no shared cache write, no other clone. A gate that runs in the same checkout at the same time reads a `node_modules` that install would empty, so a repository that runs gates in parallel guards the two with one lock under `.artifacts/`.

The contract is asked where a REPOSITORY is — a `.git` beside the project, as for [the Docs (layout) pass](#the-docs-layout-pass) — and an ignored `Makefile` counts for none, like every path a tree gate skips. A workspace member owes nothing: the repository's root answers for every member, and a member linted on its own is never asked.

A target counts when the `Makefile`'s own text writes a rule for it — `lint:`, `install build:`, `test::` — and an assignment (`LINT := …`) or a comment is no rule. A file the `Makefile` `include`s is not read, so the six stay written where a reader opens first.

`fix` runs every fixer the repository has. A preset's fixers run inside `typescript fix`, before the formatter ([A preset's checks](#a-presets-checks)), so a repository on the toolchain alone writes it as one line:

```make
fix:
	npx typescript fix
```

A repository with fixers of its own outside the toolchain runs them in one shell and carries the verdict to its end, `typescript fix` last: Make stops a recipe at its first failing line, and a fixer failing on debt it cannot settle would otherwise keep the formatter from the files it had just rewritten. With Prisma's formatter as that second fixer:

```make
fix:
	status=0; \
	npx prisma format || status=1; \
	npx typescript fix || status=1; \
	exit $$status
```

The pass reads that the rule exists, never what it runs, so this one is the page's to state and the repository's to keep.

#### A root beside the spine

A root beside the spine stands on one of two codified grounds, and every other root is refused. The first is a name a tool outside this package imposes, so the repository did not choose it and owes no declaration for it:

| Root       | Imposed by                                                              |
| ---------- | ----------------------------------------------------------------------- |
| `android/` | React Native and Expo — the native Android project                      |
| `app/`     | the Next.js App Router and Expo Router — routes are read off it         |
| `bin/`     | npm — the files a package's `bin` entry links as commands               |
| `config/`  | node-config — the default folder its `require('config')` reads          |
| `ios/`     | React Native and Expo — the native iOS project                          |
| `pages/`   | the Next.js Pages Router — routes are read off it                       |
| `prisma/`  | Prisma — the schema and migrations its CLI reads by default             |
| `public/`  | Next.js, Astro and Vite — static files served verbatim at the site root |

The list is the base preset's, and closed and short on purpose. `scripts/`, `docker/` or `migrations/` are conventions, not impositions: every tool that reads one takes its path as an argument, so the repository chose the folder and says why.

The second ground is that saying: the repository declares the root in its settings file, `jterrazz.config.ts`, under `typescript.roots`, each with its reason ([Configuration](configuration.md#the-typescript-section)). A root kept as written — quoted upstream text, a schema a generator emits, signed articles — is declared `{ reason, verbatim: true }` in the same place, which keeps it beside the spine the same way and leaves it to its author: no pass rewrites it, and `--ignore-pattern`, which once did that for one run, is retired.

```ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

The file holds one section per package of the family, each package reading only its own, so a root declared anywhere else — a `jterrazz` key in `package.json` included — is not read. A file that does not load, or whose `typescript.roots` is not an object mapping each folder to its reason (or to `{ reason, verbatim: true }`), is refused as `names/jterrazz-config-loads`, and the roots it meant to declare stand undeclared until it is fixed. The reason is not decoration: an entry without one is refused (`names/declared-root-states-its-reason`), and an entry whose folder holds no file git does not ignore is refused too (`names/declared-root-holds-files`), so the list shrinks as the tree does — the sweep drops what git ignores, a Go module's `testdata/` and the ground of a test, so a `testdata/` root is never declared. A root is a first-level folder: a nested key, one holding a `/`, is refused, and so is a folder of the spine or a member root (`packages`), which is already codified and cannot be a root too (`names/declared-root-is-first-level`). A base package that composes others keeps its broader roots through this same declaration, never through an exemption in the gate.

### The lint tree

`lint/` has one tree in every library that keeps one — the kind that ships lint rules, whose standard lists the tree's folders —, whatever the package: its entries at its root — each `index[.<name>].ts` ([The entry grammar](#the-entry-grammar)), built as a subpath the package publishes or a private `#` import, the one place a declaration meets the kit — and one folder per audience — `consumer/`, the declarations every consumer is held to; `self/`, the declarations only the repository is held to; `kit/`, what runs them and knows none — each holding what [Architecture](../concepts/architecture.md#the-judging-layer) says it holds. A reader who knows one repository's `lint/` knows every one, so the pass holds each unit that keeps a `lint/` to it, a workspace member included.

- `names/lint-root-holds-only-entries` refuses a file at the root of `lint/` that is not an entry — a `README`, a `.json`, a page, a module not named `index[.<name>]`.
- `names/lint-folder-is-known` refuses a folder of `lint/` outside the three.
- `names/consumer-folder-is-known` refuses a folder of `consumer/` outside `catalogue/`, `rulebook/`, `rules/` and `checks/`, and a file at its root.
- `names/self-folder-is-known` refuses a folder of `self/` outside `catalogue/`, `rules/`, `checks/` and `corpus/`, and a file at its root but a module composing the self declarations with the kit. A program at the self root composes; the parts it tests live in `corpus/`, tested there, so a `__tests__/` folder at the self root is refused.
- `names/kit-folder-is-known` refuses a folder of `kit/` outside `project/`, `baseline/`, `checker/`, `catalogue/`, `compiler/` and `testing/`, and a file at its root.
- `names/audience-holds-only-declarations` refuses a module of `consumer/` or `self/` that runs as a program, or that hands another module a function or a value named for something other than its file.
- `names/rule-file-in-its-family-folder` refuses a rule file of `consumer/rules/` or `self/rules/` filed at the root of `rules/`, or under a folder its catalogue row does not name.

A declaration is a rule, a check, a decision on an upstream rule, a catalogue entry, or their tests, and the pass knows one by what its module exports and who reads it: each function or value it hands another module carries its file's name — one dotted part of the file's name, hyphens and underscores dropped, is part of the export's, whatever the case — so `no-snapshot-folder.ts` may export `checkNoSnapshotFolder`, `docs.js` exports `auditDocs`, and `import.js` hands the framework fragments `IMPORT_ASSETS`. A value a module of a `catalogue/` exports is a row every declaration reads, and a value a module at the root of `lint/` — or of `self/` — imports is what that module composes: both are free. What only the module's own test imports — from the `__tests__/` of its folder — is the declaration's own, whatever its name. Types and the default export are free, and so is a file that is not a module, a test, or anything under `__expected__/` or `__fixtures__/`. A part, `<name>.<part>.<ext>` beside its `<name>.<ext>`, is that declaration cut in two, and it and the declaration read each other freely. A module handing another a function or a value named for anything else is a helper, and the kit owns the code declarations share. A module that reads `process.argv`, imports `argv` or `exit` from `node:process`, calls `process.exit`, or runs under `import.meta.main` is a program, and the checker under `kit/checker/` is the one program a declaration runs through. The modules are read as text, never run: a reader is any module of the unit that imports the file by a relative path, and it takes the names its import lists — every name, for a namespace or a dynamic import.

The family is read off the unit's own catalogues: every file directly under `lint/consumer/catalogue/` or `lint/self/catalogue/`, read as text and never run, where a row is any object literal stating an `id` or a `name` and a `family` — a JSON row and a TypeScript manifest row alike, the plugin prefix of an id left aside. A rule file is matched to its row by its name, its test with it. A unit with no catalogue, or a rule no row names, is held to the other rules alone: a family is never guessed.

### An empty directory

The tree is judged on the disk as well as by its names. git tracks no directory, so an empty one exists only on the machine that holds it — a folder a fixer or a move emptied, a scaffold nobody filled — and it tells the next reader of that disk about a part of the tree that is not there. `names/no-empty-directory` refuses a directory holding no file at any depth that git does not ignore.

A directory holding only empty directories is empty, and is named once, at its top. The walk never enters `.git/`, a directory holding a `.git` of its own, or a folder no gate reads — `node_modules/`, `.artifacts/`, `dist/` and the rest the sweep leaves out — and a directory git ignores, or a root declared `verbatim` holds, is left alone. The finding states itself in four parts, `found: … · why: … · fix: … · read: …`.

`typescript fix` deletes each one before it judges the tree, printing a `removed` line per directory, and renames nothing else. It deletes bottom-up, one empty directory at a time, so a file that landed in one since the walk stops the deletion rather than going with it. CI never meets the rule: a fresh clone holds no empty directory.

### What the ratchet records

Every rule is printed and recorded as `names/<rule>`, and carries the code `names(<rule>)`: `typescript baseline` writes the pass's counts into the `typescript` section of `.jterrazz/baseline.json`, which holds only the `architecture/` and `names/` counts, while the linter's debt lives in `.jterrazz/oxlint-suppressions.json`. Where the section holds a `names/*` entry, this pass is judged by it exactly, with the four refusals of [the ratchet](#the-ratchet), and `typescript fix` re-records the entries that fell. A project adopting the construct roster records its existing sites once and renames them by domain, one entry at a time.

## Modules

One rule of the rulebook's own oxlint plugin judges what a module holds, so its findings are the Oxlint pass's. A `*.data.ts` module is a table of rows the file-size cap stands aside for, and the rule keeps logic out of it ([Lint presets](lint-presets.md#a-data-module-holds-data)).

<!-- GENERATED:findings modules -->

| Rule                                               | Requirement                                                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jterrazz-typescript/data-module-holds-data`       | A `*.data.ts` module holds its imports, its types and the literals it exports — no function, class or statement — so the file-size cap stands aside for its rows. |
| `jterrazz-typescript/error-family-shares-its-base` | An `errors.ts` or `*.errors.ts` module holds one family of classes — a base and what derives from it — so the class-count cap stands aside for it.                |

<!-- /GENERATED:findings modules -->

## Accessibility

Two rules of the rulebook's own oxlint plugin judge what jsx-a11y cannot read, so their findings are the Oxlint pass's: a `<section>` that takes the keyboard's focus names the region it is ([Lint presets](lint-presets.md#a-focusable-section-is-labelled)), and an element's accessibility props are written where jsx-a11y reads them ([Lint presets](lint-presets.md#an-accessible-element-is-written-in-jsx)).

<!-- GENERATED:findings accessibility -->

| Rule                                                | Requirement                                                                                                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jterrazz-typescript/accessible-element-is-jsx`     | An element whose role, tab stop or aria attribute is set is written in JSX, never through `createElement`, whose props no jsx-a11y rule reads.                                                  |
| `jterrazz-typescript/focusable-section-is-labelled` | A `<section>` that takes the keyboard's focus names the region it scrolls with `aria-label` or `aria-labelledby`, since an unlabelled section is no region and its `tabIndex` a stray tab stop. |

<!-- /GENERATED:findings accessibility -->

## Promises

One rule of the rulebook's own oxlint plugin judges how a promise is read, so its findings are the Oxlint pass's: a promise is awaited, and a `.catch()` given a value — a schema's fallback — is no promise ([Lint presets](lint-presets.md#a-promise-is-awaited)).

<!-- GENERATED:findings promises -->

| Rule                                     | Requirement                                                                                                                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jterrazz-typescript/promise-is-awaited` | A promise is awaited, never threaded through a `.then()`, `.catch()` or `.finally()` chain nor wrapped in an async function called at the module's top level — and a `.catch()` given a value, which no promise takes, is a schema's fallback the rule leaves alone. |

<!-- /GENERATED:findings promises -->

## Runtime

One rule of the rulebook's own oxlint plugin judges what an engine does differently from the type check: on a platform whose engine is Hermes, `matchAll` is not given a pattern with a named group ([Lint presets](lint-presets.md#matchall-keeps-no-named-group-on-hermes)).

<!-- GENERATED:findings runtime -->

| Rule                                               | Requirement                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `jterrazz-typescript/no-named-groups-in-match-all` | `matchAll` is not given a pattern with a named group on Hermes, whose iterator leaves `match.groups` undefined. |

<!-- /GENERATED:findings runtime -->

## Comments

Two rules of the rulebook's own oxlint plugin judge the comments of code, so their findings are the Oxlint pass's and their debt, like any rule's, is `.jterrazz/oxlint-suppressions.json`'s. What each one holds, and the four kinds a comment may state, are [Lint presets](lint-presets.md#a-comment-states-its-kind)'s.

### The Comments (styles, scripts, YAML) pass

oxlint reads code alone, so the comments of every other file the repository writes are this pass's: the `/* … */` of a `.css` and a `.scss` — a Sass `//` line too — and of the `<style>` block of an `.astro`, `.svelte` or `.vue` file, and the `#` lines of a shell script (`.sh`, `.bash`, `.zsh`), a Makefile (`Makefile`, `GNUmakefile`, `.mk`), a Dockerfile and a YAML file, a lockfile aside. It reads every file git does not ignore, the ground a test stands on and what is kept as written left out, and runs only where the tree holds one of them. Like [the Markdown pass](#the-markdown-prose-pass), it never reads what the formatter keeps byte for byte — a content tree, a root a script writes, a path handed to the formatter to leave alone, in the root and in every workspace member: a style sheet or a YAML file a site signs keeps its comments as written.

A `#` comment is a line that opens with `#`, and a run of them states its kind once, on its first line, as a run of `//` lines does; a comment trailing a command is the command's text, which only its interpreter could tell apart. A shebang, the lines a heredoc carries and the lines of a YAML block scalar (`run: |`) are text, never a comment of the file. A directive another tool reads states no kind: `# shellcheck …`, `# yamllint …`, `# hadolint …`, `# yaml-language-server: …`, a Dockerfile's `# syntax=`, `# escape=` and `# check=`, `# renovate: …`, `@jterrazz/test`'s `# checker-disable-next-line …` in a spec document, and in a style sheet `/*! … */`, which every minifier keeps, `/* stylelint-disable … */` and `/* prettier-ignore */`; so does every comment of a file whose first five lines carry `@generated`.

A Go file's `//` runs and `/* */` blocks are read with Go's shapes. The comment directly above the package clause or above the declaration of an exported name (`func`, `type`, `var`, `const`, or a name of a `const (` block) is godoc's documentation, shown on hover, and states no kind; every other comment opens with its kind, and the go tool's own — `//go:build`, `//go:generate`, `//nolint`, `// +build`, `//export`, a `// Code generated … DO NOT EDIT.` header, which leaves the file unread — are directives. A string, a raw string or a rune holding `//` is not a comment. A Go module's `testdata/` and `*_test.go` are the go tool's ground, left out of every sweep like the ground of a specs tree, and a unit holding a `go.mod` tells knip its `go` binary is the machine's.

`typescript fix` deletes no comment. `typescript check` reports each one that states no kind at its line, and the agent that reads the finding decides: keep it with its kind, or delete it. A deleted comment is a decision about what the code cannot say, and a tool cannot take it: it removed a test's `// Then` marker, the only content of a `catch {}`, a twoslash `// ^?` that a video was built from.

<!-- GENERATED:findings comments -->

| Rule                                                      | Requirement                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jterrazz-typescript/comment-no-longer-than-its-function` | A comment run above a function is no longer than the function it documents.                                                                                                                                                                              |
| `jterrazz-typescript/comment-states-its-kind`             | A comment opens with the kind of thing it states — invariant, hazard, outside or value — unless it is an exported symbol's hover doc (one line of prose, its block tags after it), a directive or a marker another tool reads, whose reason states none. |
| `comments/comment-states-its-kind`                        | A comment of a style sheet, a shell script, a Makefile, a Dockerfile or a YAML file opens with its kind, as a comment of code does — unless it is a directive another tool reads.                                                                        |

<!-- /GENERATED:findings comments -->

## The Secrets (credentials) pass

No file the project would commit carries a live-looking credential. Two scanners answer that one question, over the same files — every one git does not ignore, the ground a test stands on left out, as for every tree gate, and a root declared verbatim included: a credential is one wherever it is quoted. Where `gitleaks` is on PATH it runs as `gitleaks dir . --no-banner --redact` over a copy of exactly those files, so a finding names the file and never reprints the secret; where it is not, ten patterns over their text answer well enough to stop the leak that actually happens — a token pasted into a note and committed with it.

Which scanner runs is decided inside the gate rather than by the command, because the gate applies either way. The command decides whether a pass applies; this one always does, and what changes is only who answers.

<!-- GENERATED:findings secrets -->

| Rule                       | Requirement                                      |
| -------------------------- | ------------------------------------------------ |
| `secrets/no-private-key`   | No committed file carries a private key block.   |
| `secrets/no-aws-key`       | No committed file carries an aws access key.     |
| `secrets/no-github-token`  | No committed file carries a github token.        |
| `secrets/no-slack-token`   | No committed file carries a slack token.         |
| `secrets/no-tailscale-key` | No committed file carries a tailscale key.       |
| `secrets/no-signed-jwt`    | No committed file carries a signed jwt.          |
| `secrets/no-grafana-token` | No committed file carries a grafana token.       |
| `secrets/no-api-key`       | No committed file carries an api key.            |
| `secrets/no-iban`          | No committed file carries a bank account number. |
| `secrets/no-service-token` | No committed file carries a service token.       |

<!-- /GENERATED:findings secrets -->

**There is no exception list, and there will not be one.** A hit is forgiven by exactly one thing: the same line declaring itself `fake`, `dummy`, `example`, `sample`, `synthetic` or `redacted`. A path allow-list is the first place a real leak hides, so the only way to silence this gate is to make the line say what it is.

## Mutation

```bash
typescript mutation                                # the module tests, then the whole suite over what they let live and the changed lines they leave
typescript mutation --since <ref>                  # the change measured from a named commit instead of the branch's merge-base
typescript mutation --mutate src/a.ts:10-20        # both runs pointed at the lines named, changed or not
typescript mutation --mutate src/a.ts:1-9,src/b.ts:4-8   # several ranges, one comma-separated value: a second --mutate is refused
```

Not a pass of `check`: [Stryker](https://stryker-mutator.io) rewrites the sources one mutant at a time and asks whether a test fails, which says what the coverage number cannot — whether a line the tests run is a line they judge. The command derives Stryker's configs and the Vitest configs they run into `.artifacts/stryker/`, and a project keeps none of them: Stryker and its Vitest runner are this package's dependencies. A run is two, each incremental, each with its own report:

A project that holds no module test and no `specs/` has no test to run a mutant against: the command says `measured nothing` and why, and exits 0, instead of stopping on a stack trace. A workspace root keeps no Vitest config of its own, so at a workspace root the command measures each member in its own folder, in turn, as `cd <member> && typescript mutation` would — the member's tests, its sources, its artefacts under its own `.artifacts/stryker/` — prints the member's name before its run, and fails when any member's verdict fails. `--since` reaches every member; a `--mutate` range is named from the root and measured by the member it sits in, and a member no range names is not run.

1. **The module tests** run against the sources they test: among the sources the declaration names — `src/` at the root and in every workspace member, the routes a framework reads its code from (`app/` on next and expo, `pages/` on next), and `.tsx` beside `.ts` on react, next and expo — each one with its `<name>.test.ts` in the `__tests__/` of its folder. Only the `unit` project runs, so it is fast enough for every `make check`. Its report is `report.json`.
2. **The whole suite** — every project but the browser ones, and none of a mobile app's specs that drive a simulator ([Configuration](configuration.md#the-standard)), against a build of the instrumented sources (the project's own `build` script, where it keeps one) — runs against every mutant the module tests let live, wherever it stands, and against what they could not measure on the lines the change touched: a source with no module test, a line of a tested source no module test runs, and a module-level mutant only loading ran that the tests loading it let live ([below](#what-a-module-test-cannot-say-of-a-table)). A spec spawns the command it proves, so every process a test spawns imports a reporter first: the parent hands it the active mutant, and the reporter hands back the mutants it ran, credited to the test that spawned it — what is new at the end of each test, when the run asks every live reporter to flush and waits for its acknowledgement ([below](#what-each-kind-leaves-unmeasured)), and every 25 milliseconds besides. A process sent SIGTERM or SIGINT hands back what it ran before it dies of that signal, the reporter raising it again once its own handler is gone; one killed by SIGKILL loses only its last 25 milliseconds; one still running after its test file's last test hands back nothing more, its credit already read. What only such a process ran reads as run by no test. A mutant a module test runs and lets live is the suite's to answer: the doctrine proves behaviour end to end first, so a line a module test only runs may be one a spec judges, and the run fails only on what the suite lets live too ([ADR-022](../decisions/022-a-module-tests-survivor-is-the-suites-to-answer.md)). The suite starts whenever the module tests let a mutant live or the change reaches a line they leave, and not when a module-test run stopped midway left mutants it never judged. Its report is `suite-report.json`.

The change is the working tree against a commit. By default it is the change not yet committed, against `HEAD`, so `make check` measures what is about to be committed; and where the working tree is clean it is everything the branch holds beyond the default branch (`origin/HEAD`'s, else `main`, else `master`) — `merge-base..HEAD` — or, on the default branch itself, the last commit against the one before it, so a gate run after the commit still measures it instead of passing on an empty diff ([ADR-023](../decisions/023-a-committed-change-is-still-a-change.md)). The verdict prints its scope, `measured 137 mutants over 56df803..HEAD`, and a run that mutated nothing says `measured nothing over <range>: <why>` — no changed TypeScript source, or a project with no TypeScript source to mutate, a Go-only product — instead of passing as a run whose every mutant was detected. Another base is named: `--since <ref>`, or `TYPESCRIPT_MUTATION_SINCE`, which the shared validate workflow sets to the commit a push or a pull request started from — a blank variable reads as unset. A commit named either way that git cannot resolve — one a force-push dropped, the zero commit of a branch's first push — is refused before anything runs, since the suite would measure nothing of the change and pass. Lines a hunk only deletes reach no mutant; a file moved or renamed is read by its content (`git diff -M`), so a pure move brings no line and a move with edits only the lines it changed — the budget of a migration is one run per moved module that is not a pure move; a file git does not track yet is changed whole; a hunk of a source with no module test that holds only blank lines, comments and one-line imports holds no mutant, and starts no suite. A hunk of such a source runs to the end of every node it opens — a block, a call, a literal over several lines — since Stryker mutates only a node its range holds whole; and of the suite's report, the verdict counts for such a source only what this run's ranges held, never a result an earlier run left there. The suite measures the change to the sources: a change to a spec alone brings it nothing, so a spec weakened by a change is measured when a later change reaches the lines it proves. A mutant of the suite costs a run of every test that reaches it, and the specs of a command reach most of its code: measured over the whole tree of this package, the suite ran six mutants in eleven minutes and estimated sixty hours for the 11,200 the module tests left. A change is what a gate can afford; `--mutate` points both runs at named lines by hand, whatever changed: it measures lines no change brought (78 unrelated survivors beside the 22 of a change), so the faithful probe of a branch is `--since <base>`, never `--mutate`. On a branch, a verdict whose scope is narrower than `merge-base..HEAD` — an uncommitted change, a `--since` newer than the merge-base — prints one `warning:` line naming the commits it did not measure: a wave reports green only from a committed tree. `--cold` — or `TYPESCRIPT_MUTATION_COLD`, set to anything — starts the suite's run from no incremental report, whatever the ground did: `make check` passes it, so a gate never stands on a "killed" verdict an earlier tree earned (a source renamed leaves the ground hash where it was); the module run stays incremental. A range that reaches no source the run mutates — a path it does not hold, lines written other than `from-to` in order, or, at a workspace root, a path in no member — is refused before anything runs, since both runs would measure nothing and pass.

What a run measures beyond that, and what it leaves out, is declared under `typescript.mutation`, each glob mapped to its reason: `mutate` the sources the platform does not name, `exclude` the tests that cannot run against instrumented code — one that type-checks the built declarations, which an instrumented build infers wider —, and `ignore` the sources no test of the package can judge. A library's standard already measures the `lint/` it ships — its entries, `lint/consumer/` and `lint/kit/` ([Configuration](configuration.md#the-standard)). A test that reads the sources as text reads them as written, never instrumented: it resolves its root through `originalOf` from `@jterrazz/typescript/rules`, which hands back the project's path for one inside a sandbox, and runs with the rest. One story covers every path a test builds from its own location: a path taken from the sandbox reaches the original tree through `originalOf(import.meta.dirname)`. The constructs that resist instrumentation, as far as met: styled-jsx's `<style jsx>` templates; a `"use client"` directive is not one.

A mutant never touches the checkout. Stryker copies the project into a sandbox under `.artifacts/stryker/tmp/` — everything but `node_modules/`, which it links, a tool root git ignores — the `ios/` and `android/` an Expo prebuild lays, which no test reads and whose socket files no copy survives —, and `.artifacts/`, of which it keeps the configs the command derives and the repository's own scripts, built into `.artifacts/dev/` — and instruments, builds and tests there, so a run stopped at any point leaves the sources, `dist/` and the root as they were. The sandbox lies in an ignored folder, where git sees no tree, and the checks a test runs read the git tree: before the first test, the sandbox becomes a repository of its own, every file it holds added, and the project's build runs there after, before the module stage as before the suite — a Prisma client the build generates into `.artifacts/` is a file the module tests load, and the copy leaves `.artifacts/` out. That build then takes the declarations of the project's own `dist/` over the ones it emitted: a mutant changes what the code does, never what it declares, and a declaration emitted from instrumented code infers wider types than the code states — so a test that type-checks the built declarations runs against the suite like any other, its project built first, as `make mutation` builds it. The suite runs on the `PATH` `npm test` gives it, `node_modules/.bin` first, whoever started the command, and each of its test files in a process of its own, as Vitest does by default: Stryker's worker threads crash on a native addon a spec loads, a database driver among them.

### Every mutant a test runs is detected

A run ends on one verdict, printed with its scope (`measured 137 mutants over 56df803..HEAD — every mutant a test runs is detected`): every mutant a test runs is detected — killed, or timed out — or declared. A survivor is a line a test runs and lets change unseen, and the run fails naming each one at its place, `src/discount.ts:2:9  ConditionalExpression → false`, before the four-part lesson, each followed by the report it is read from (`(.artifacts/stryker/suite-report.json)`); the verdict lists the survivors of the scope it measured only, never those an incremental report keeps from an earlier run, and Stryker's own listing of that report is not printed. The fix is an assertion of what the line decides, and a value compared whole kills most of them. A mutant that no change of behaviour can tell apart — a cache that only saves time, a comparator over keys that never tie — is declared where it stands, `// Stryker disable next-line <mutator>: <why it is equivalent>`, and the reason is read in review like any other suppression. The Suppressions pass refuses a directive with no reason after its colon, and one that names `all`: it silences every mutator that line opens, today's and the next change's, where a declaration is about the mutators named. A directive covers the line it names, and a block starts on the line of its opening brace — `// Stryker disable next-line` above `} catch {` covers that line, never the catch body under it; a block is declared by a `// Stryker disable <mutator>: <why>` … `// Stryker restore <mutator>` range around it. Five shapes are no equivalence to declare, since each has a form that holds no mutant: [Writing what a mutant can tell from the original](#writing-what-a-mutant-can-tell-from-the-original). A mutant no test runs at all is no survivor: the run counts them file by file. A component, an island or a template (`.tsx`, `.jsx`, `.astro`, `.vue`, `.svelte`) runs in the browser, where the run starts no project: its mutants no test ran are printed apart as `unmeasured: N mutant(s) of browser-side sources`, file by file, so a site's hydrated half never reads as covered. One the module tests left on a line no change has reached is counted apart, in one number, until a change brings it to the suite. A source with no module test is mutated by no run until a change reaches it, so its mutants are in no count: the run counts those sources apart, in one number of files; one a change brought there that the suite's report does not carry was judged by nothing, and fails the run. A mutant the module tests let live and the suite detects counts among the detected, and the verdict says how many the suite answered that way. A mutant that did not compile, errored at runtime or was declared is outside the verdict, counted by its status. A mutant of any other status — left `Pending` by a run stopped midway, or with no status at all — was judged by nothing, and fails the run, as a run that leaves no report is refused rather than passed.

There is no score and no floor to hold: zero is the only count the verdict accepts, so nothing is recorded in `.jterrazz/baseline.json` ([ADR-019](../decisions/019-mutation-judges-zero-survivors-not-a-score.md), [ADR-020](../decisions/020-mutation-measures-the-whole-suite-over-a-change.md)). The incremental files under `.artifacts/stryker/` keep each run to the mutants of what changed, which is what lets a repository run it inside its own `make check`, and the shared validate workflow run it on every push. Stryker keys a test by its file's text, so a fixture, a golden or a setup file a test reads (`__fixtures__/`, `__expected__/`, `__requests__/`, `__seeds__/`, `__setup__/`) could change under a test whose text did not: the run keeps a hash of that ground beside each incremental file and starts the stage from nothing when it moved, so a mutant is never reported from a verdict the ground has outlived.

### What a module test cannot say of a table

A mutant of code that runs as a module loads — a table such as the rulebook, a pattern, a message, the definition of a function — is static to Stryker: no test is running when it runs. Stryker's own answer is to rerun every test against it, or, under `ignoreStatic`, to skip it. The run's setup credits it instead to every test of each file whose loading ran it, and activates a mutant before the test file loads, so the mutant is live when the module-level code runs. Each static mutant then runs against the tests of the files that load it, and a mutant no test file's loading reaches stays skipped. A mutant that stops a test file from loading — a table emptied that the module reads as it loads — is detected: the file's failure counts as a failed test, where Stryker, finding no test in the file, would read it as survived.

A test that loads a module has not read what the module defines: a table survives the module tests of every file that merely imports it. So a static mutant the module tests detect counts as detected, and one only loading ran that they let live is left to the suite, like a line no module test runs: the suite runs the module where it is used. A static mutant a test also ran — a function the module calls to build a table and a test calls again — is the module tests' to answer, like any line they run: each test file writes, during the first run, the mutants its tests ran in its own process beyond loading it, and such a mutant that survives is handed to the suite with every other survivor, and fails the run when the suite lets it live too. A process a test spawns hands back loading and calls alike, so what only a spawned process ran beyond loading is left to the suite with the rest.

### What each kind leaves unmeasured

The suite credits a mutant to a test only where a process the run started ran it — the test's own, or one it spawned, which imports the reporter. At the end of each test the run asks every process that test spawned and that still runs to hand back what it ran, and waits for each to answer, one second at most, so what a server ran during a test is credited to it and not to the next one; a process ended by `SIGTERM` or `SIGINT` hands back before it dies. What runs anywhere else is run by no test the run can credit, and is counted, never judged:

| Kind      | What the suite measures                                                                            | What no run can credit                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `api`     | the server its specs boot, in their process or spawned                                             | nothing beyond the rule                                                                                                                |
| `cli`     | the command its specs spawn, built from the instrumented sources                                   | a binary compiled by another runtime (`bun build --compile`), which loads no reporter                                                  |
| `library` | its module tests, and the specs that import or spawn its build                                     | nothing beyond the rule                                                                                                                |
| `website` | the served pages' server code, which the website project's specs spawn from the instrumented build | code only the browser runs — an island's client code — and code the build runs once to prerender a page, before any mutant is active   |
| `mobile`  | its module tests and its non-device specs                                                          | everything only the simulator runs: the mobile specs are left out of every run, as a device session per mutant would cost minutes each |

A mutant no run can credit reads as run by no test, in the count file by file; a source no module test reaches is counted apart until a change brings it to the suite. Moving the logic a page or a screen only renders into a module its tests can call is what brings it under the verdict.

A hydrated island owes the same. Client-only code is invisible to a server render: the dependency array of a hook (an `ArrayDeclaration` mutant), an event handler, an effect and the server-initial branch of a client state (`isOpen && …`) run in no measured run, so their mutants read as run by no test. The shape the verdict judges is the logic in a `.ts` module under module tests, and the markup compared whole by a spec; what is left is declared equivalent, with its reason. No treatment of dependency arrays is built in: one directive per array is honest, where a blanket mutator exclusion would hide the real ones. An Astro component loaded with `client:only` is browser-side whole, read as an island is and left unmeasured, with no `typescript.mutation.ignore` to write for it.

### Writing what a mutant can tell from the original

Five shapes breed mutants no test can kill, because the mutant behaves as the original does; each has a form that holds none.

- **A field omitted when it is undefined.** `...(value === undefined ? {} : { value })` mutates its condition and its two branches into code that returns the same record for every input the tests can name. Write the field itself, `{ value }`, with the type `value?: T | undefined`, or destructure what the caller passes: the record has one shape, and there is no branch left to mutate.
- **A named group read with a default.** Under `noUncheckedIndexedAccess` a group a pattern always fills is typed `string | undefined`, and `?? ''` is a branch no input reaches. `groupsOf(match, ['name', 'version'])`, exported by `@jterrazz/typescript/rules`, returns each group as a string and throws when one is missing, which a pattern that always fills it never does.
- **A guard that only narrows a lookup that cannot miss.** Under `noUncheckedIndexedAccess` a guard written to narrow `array[i]` is a dead branch, and so is `?? ''` or `=== undefined` after `charAt`, after an index on a typed key union (`Record<'a' | 'b', …>`) and after a `find` over a closed registry: none of them can miss, so the guard is a mutant that cannot die. Read the value through `.at()` and narrow it with `present(value)`, exported by `@jterrazz/typescript/rules` beside `groupsOf`, which throws on `undefined` as an invariant and so holds no branch to mutate.
- **A loop bounded by a depth counter.** `for (let depth = 0; depth < 8; depth += 1)` keeps a mutant at its bound, since no test builds a tree of eight levels. Loop to the natural end — the filesystem root, the last entry — and hand each value of the loop to a helper (`no-loop-func`).
- **A fixture whose first or only value is the default.** A list of translations whose first is English hides every mutant of the default English: build fixtures whose first value is not the fallback.

`--mutate <file>` applies the default run's policy to the file it names: a static mutant — a module-level table, a pattern, a message — a module test detects is detected, and one only loading the module ran is left to the suite, so the report of a file named alone is the report the file has in the default run.

A workspace member's specs run in the sandbox beside the roots the repository declares (`typescript.roots`), laid next to the member's copy: a spec that climbs a fixed number of folders to read a file of the repository root finds it where it climbs to.

## Pitfalls

- **A nested `oxlint.config.*` is loaded only on the path of a file oxlint is handed.** `check` hands it the sweep, which never holds the ground a test stands on, so a config committed under `__fixtures__/` is never read, armed or broken. Handed a directory instead — the fallback when the sweep could not answer — oxlint discovers every config beneath it and loads them all before it lints anything, and one that cannot load fails the run.
- **An ignore without a reason is the expected form of nothing.** Every entry under `typescript.knip` tells the gate to overlook something, and the next reader would have to re-derive why — so each one maps to its reason ([Lint presets](lint-presets.md#unused-code-knip)).
- **An export used in its own file is not dead.** The base preset sets `ignoreExportsUsedInFile: true`, so the `cleanup-passed-to-after-all` idiom's same-file `cleanup` and a capsule's flags read back by its sibling test never need a `typescript.knip` line to stay unreported.
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.
- **Knip runs uncached, on purpose.** Its `--cache` would be the obvious speed-up and it can lie: a cached glob is validated against the mtimes of the directories that held a match, so a file added to a directory that held none is invisible, and the cached run passes a project the uncached run fails. Every other cache in the toolchain — tsc's buildinfo — is keyed on content and cannot.

## Related

- [Lint presets](lint-presets.md) — the rulebook, how the config merges, knip.
