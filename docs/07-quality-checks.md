# Quality checks

`typescript check` runs every quality pass in parallel and fails on any finding; `typescript fix` repairs what can be repaired without a human. This chapter is the reference of both: one section per pass, in the order a run prints them, then the ratchet that holds a project's debt and the drift report that closes every run.

## Reading a run

Every pass that ran prints the same block: a `RUN` header carrying its name, whatever it has to say, and one verdict line. A pass that did not apply, such as Astro in a project without Astro, prints nothing at all, because it answered no question.

A failing pass prints its whole log. A passing one stays silent, unless it wrote something (`fix` changed a file the operator owns) or a ratchet held it. A tool's success chatter never reaches the stream, so a green run is the same on every platform.

A finding the toolchain writes is one line in the compiler's convention, `path:line:column: error <pass>(<rule>): …`, followed by its lesson in four parts: `found: … · why: … · fix: … · read: …`. The `read` is a heading of this manual, so a reader lands on the section that explains the rule.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package pass once per member, and a single-package project is the same run it always was.

### Flags and exit codes

`check` and `fix` run whole, every pass that applies over the whole project: no flag runs one pass or one file. They take two flags:

- `--ignore-pattern <glob>`, as many times as needed, leaves a path out ([below](#leaving-a-path-out)).
- `--json`, on `check`, prints [the drift report](#the-drift-report) as one JSON object for a machine; every pass above it still prints for a person.

Every command exits `0` when it succeeded and non-zero otherwise; `check` and `fix` exit `1` when any pass failed or the drift report refused. CI runs `make check` and reads that code, and on a GitHub runner oxlint prints its diagnostics as workflow annotations ([One run, printed as oxlint prints it](#one-run-printed-as-oxlint-prints-it)).

`fix` rewrites the project's files in place — the formatting, the linter's safe fixes, the order of `package.json`, the `.gitignore`, two directive spellings, empty directories, the baseline's fallen counts. Run it on a committed tree, and read its diff before committing it.

## The passes

`typescript check` runs up to sixteen passes. The Config pass runs first, three spawn a tool on every invocation, knip and five tree gates run on every `check`, and the other six are opt-in — they appear only when the project qualifies.

| Pass                      | Tool                        | When it runs                                                                                     |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Config (one file)         | the config gate             | always (check and fix — `--fix` writes the derived files)                                        |
| TypeScript Check          | tsc (TypeScript 7, Go)      | always                                                                                           |
| Oxlint Check              | oxlint (`--type-aware`)     | always (judged by the ratchet's `typescript` section where there is one)                         |
| Oxfmt Check               | oxfmt (Rust)                | always                                                                                           |
| Gitignore (artefacts)     | the artefact gate           | check: project or ancestor `.gitignore`; fix: project's own                                      |
| Knip (unused code)        | knip (Node)                 | always (check only — it is not run in fix)                                                       |
| a preset's label          | the preset's checks         | per `specs/` root and per member, for each declared preset that brings checks (check and fix)    |
| Docs (layout)             | the manual gate             | check: at a repository root (a `.git` beside the project)                                        |
| Publish (packaging)       | publint + attw + a build    | per package the registry would accept (not `private`)                                            |
| Architecture (layer map)  | dependency-cruiser          | a `jterrazz.config.ts`, or a `.dependency-cruiser.*` (check and fix — `--fix` re-records a fall) |
| Astro (check + format)    | astro check + prettier      | per project that depends on `astro` (check and fix)                                              |
| Suppressions (directives) | the suppression gate        | always (check and fix — `--fix` settles two spellings)                                           |
| Markdown (prose)          | rumdl + the prose gate      | always (check and fix — `--fix` runs rumdl's own fixes)                                          |
| Names (tree)              | ls-lint + the naming gate   | always (check and fix — `--fix` deletes an empty directory)                                      |
| Comments (density)        | the comment gate            | always (check and fix — `--fix` re-records a fall)                                               |
| Secrets (credentials)     | gitleaks, else the patterns | always (check only — a leak is rotated, not reformatted)                                         |

`typescript fix` runs the config gate, tsc, oxlint (`--fix`), oxfmt, the artefact gate, the suppression gate, dependency-cruiser (`--fix` re-records a fall), rumdl (`--fix`) with the prose gate, the naming gate and the comment gate — knip, the conventions checker, the Docs (layout) pass and the remaining tree gates are check-only (they are read-only gates, not fixers).

### In a workspace

When the `package.json` at the cwd declares `workspaces`, the per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/package.json` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed.

The Docs (layout) pass measures from neither: its unit is the repository, and the section below says why.

The other four passes are root-only, and that is not an omission. tsc, oxlint and oxfmt measure from their **config file**, not from a package, and each already reaches the whole tree from the cwd — oxlint and oxfmt through the project's files they are handed. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

Discovery never leaves the workspace. A candidate is dropped when git ignores it — clones, workbenches and build output live under gitignored paths — and when the walk had to cross a nested `.git` or a `package.json` that no workspace glob claims to reach it: a vendored project's conventions are its own, not yours.

### Leaving a path out

Three doors, each narrower than the one before it:

- **`.gitignore`.** The linter, the formatter and every tree gate read the same sweep, the files git does not ignore, so a path git ignores is out of all of them: generated output, a local data folder.
- **`--ignore-pattern <glob>`** on `check` and `fix`, written into the `package.json` scripts so every run passes it: a tracked path left out of the linter, the formatter and the tree gates — Suppressions, Markdown, Names, Comments and Secrets.
- **`typescript.oxlint.overrides`** or **`typescript.oxfmt.ignore`** in `jterrazz.config.ts`, each with its reason: the rules a set of files is judged by, or the files the formatter leaves as written ([Configuration § The lint rules](06-configuration.md#the-lint-rules)).

tsc reads the files its tsconfig preset includes, and knip what its preset and the project's `typescript.knip` name ([Lint presets](08-lint-presets.md#unused-code-knip)): neither reads the sweep.

### An unreadable tree

Every tree gate reads the same sweep: the files git does not ignore, or the disk outside a git checkout. A sweep that comes back empty while the tree holds something — folders and no file, or files git ignores whole — is refused rather than read as nothing to judge, since a gate over nothing passes. The pass prints the refusal in four parts, `found: … · why: … · fix: … · read: …`, and fails.

## The Config (one file) pass

The root holds what a person wrote, and one file says what the project is. This pass holds both: `jterrazz.config.ts` declares a kind and a platform from the two closed lists ([Getting started](05-getting-started.md#1-declare-what-the-project-is)), the files an editor reads at the root are the lines that declaration derives, and no tool keeps a config of its own beside it. It runs first, at the root and in every workspace member, and reads nothing but those files and the manifest.

<!-- GENERATED:findings config -->

| Rule                             | Requirement                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/project-declared`        | A repository, and each member of a workspace, declares what it is once — its kind and its platform — in jterrazz.config.ts.                                                                                                                                        |
| `config/editor-file-derived`     | Each config file an editor discovers is the file jterrazz.config.ts derives, so the editor and the check judge alike.                                                                                                                                              |
| `config/editor-file-in-its-unit` | An editor file sits in the unit it is derived for: the oxlint and oxfmt configs at the repository root alone, a tsconfig.json — or a preset's file such as vitest.config.ts — in each declared project, and never at a workspace root, which declares no platform. |
| `config/no-tool-config`          | A tool only the toolchain runs keeps no config file of its own: the command hands it the config jterrazz.config.ts derives.                                                                                                                                        |
| `config/kind-matches-manifest`   | A library publishes its exports, a cli names its bin, and an application — an api, a website, a mobile app — is private, never published.                                                                                                                          |

<!-- /GENERATED:findings config -->

### The derived files

An editor reads `oxlint.config.ts`, `oxfmt.config.ts` and `tsconfig.json` by their names, so they stay at the root, but their content is the toolchain's: the oxlint and oxfmt configs hand their own `import.meta.url` to the `oxlintConfig` and `oxfmtConfig` of the `./oxlint` and `./oxfmt` entries, which derive the config from the `jterrazz.config.ts` of the module's directory — the `url`, never `dirname`, which a browser platform's types do not declare, nor the `import.meta` object, which knip's loader, jiti, hands over as its own wrapper's — and the tsconfig is an `extends` of the platform's preset, with what `typescript.tsconfig` adds to it and why. A config names its directory because nothing else knows it: an entry deriving from the directory the tool runs in dropped every preset and setting, with no error, when oxlint ran from `src/`, and Node loads an entry once per process, so a language server serving two projects would hand both the first one's config. What was run as an editor runs it: `oxlint --lsp` started at the project root loads the config and reports the profile's rules, the TypeScript 7 language server resolves the `extends`, and the Vitest extension loads `vitest.config.ts` from its own directory. Started on a folder above the project — an estate of nested clones opened whole — oxlint, CLI and language server alike, finds the config as a nested one, refuses the `options.typeAware` it sets, and lints with its own defaults: open the editor on the project. A workspace keeps the two configs at its root alone, which derive each member's own rules; a file every unit keeps — a `tsconfig.json`, or a preset's own such as `@jterrazz/test`'s `vitest.config.ts` — is owed by each member and never by the workspace root.

`typescript fix` writes every derived file that is missing or says something else, and `check` names the content to write. A setting that once lived in one of them — a rule turned off, a path the formatter skips — moves to `jterrazz.config.ts`, under the section its owner reads, with its reason ([Configuration](06-configuration.md#the-typescript-section)).

### No config of its own

knip, tsdown and Stryker are run by the command alone, which derives their config and hands it over by path, so a `knip.json`, a `tsdown.config.ts` or a `stryker.config.json` at the root is a second place a setting could hide. So is an alternate name of an editor file (`.oxlintrc.json`, `oxlint.config.mts`), a `.dependency-cruiser.*` or `.ls-lint.yml`, a second vitest config (`vitest.<name>.config.ts`), and a member's own `oxlint.config.ts`, which would replace the root's in its subtree. Each is refused, naming where its settings go.

### The kind and the manifest

The kind says what the manifest must hold: a `library` publishes `exports` or a `main`, a `cli` names its `bin`. A project that declares itself one and publishes as the other is refused at its `package.json`, since every law that follows from the kind would judge the wrong thing.

## The Gitignore (artefacts) pass

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root ([Getting started](05-getting-started.md#where-a-tools-output-goes)), and this pass reads that convention off two files: the project's own `.gitignore`, and the nearest ANCESTOR `.gitignore` above it — the workspace root's, found by walking up to the nearest directory holding a lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `npm-shrinkwrap.json`) or a `workspaces` manifest. That walk stops at the nearest repository boundary and never passes it — a `.git` directory in a clone, a `.git` file in a worktree — because a clone checked out inside another repository is not a member of the tree it sits in, and the `.gitignore` above that boundary answers for somebody else's artefacts. A project carrying its own `.git` therefore has no ancestor at all. It runs when either file exists — a project with neither names no artefact path — and each is judged by the same rules.

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

A preset may bring checks of its own beside its laws: its `checker` names a module whose default export is a `Contribution` of the [rules kit](10-rules-kit.md) — its passes, the baseline section they hold, its commands — and the label its verdict is printed under. `@jterrazz/test`'s `test()` brings its conventions this way, under `Test Conventions (@jterrazz/test)`, and the question they answer is "does this project write specs the way the framework says". There is no second command: `typescript check`, `fix` and `baseline` run every declared preset's checks through this package's own checker program, and the module is a declaration, never a program of its own.

A preset's checks run once over the repository, at its root, and the preset walks what it owns there itself — `@jterrazz/test`'s conventions read every `specs/` tree and every workspace member, a member with no `specs/` included, since a package with a `test` script and no `vitest.config.ts` owns a question no specs tree can be asked. The toolchain knows the units, never what a preset judges inside them. A member that declares presets of its own in its own `jterrazz.config.ts` is run once more, `--member <dir>`, by the checks its file imports — its own install, not the one the root hoisted — and a project with no declaration is judged by none: a clone sitting inside another tree is never judged by the presets the tree around it declares.

The verdict is the checks' exit code, and nothing here forgives it: a preset records its own debt and judges it, in its own section of the ratchet file ([the ratchet](#the-ratchet)). `fix` runs every preset's checks with `--fix` first, one run after another, before oxlint and the formatter, so the last writer of every file is the one `check` judges its format by; `baseline` runs the `baseline` command of each preset holding a section of debt after recording its own sections; a preset whose sections are all floors is skipped, since a floor is recorded by the gesture that measures it.

A green pass says one thing about each section a listed preset holds: the held line of the run over the project root, `.jterrazz/baseline.json › test: <n> held across <k> rules` — or `.jterrazz/baseline.json › test: nothing held` for a project keeping no `test` section. The sections are the ones the presets of `jterrazz.config.ts` declare in their `baseline`, the toolchain's own and every floor aside, so a preset that declares no section is shown no line; a line in any other shape is left out rather than echoed as a second shape.

A preset's checks judge their own passes and nothing of oxlint's: a plugin's `jterrazz(*)` diagnostics are oxlint rules, printed by the Oxlint pass and held in `.jterrazz/oxlint-suppressions.json` ([the ratchet](#the-ratchet)). So the runs start beside the linter rather than after it, and none of them lints the project.

## The Docs (layout) pass

Every repository carries the same manual — a map at `docs/README.md`, the docs spine, and its own chapters numbered contiguously after it — and this pass refuses a tree that breaks it.

The **docs spine** is four chapters at fixed numbers: `01-architecture.md`, `02-developing.md` and `03-testing.md` in every repository, and `04-operating.md` in one that ships an image or a package. It is not [the root spine](#the-root-spine), the folders a repository root may hold, which the Names pass judges. `decisions/` is optional: a manual with none owes neither a record nor a template.

Its unit is the **repository**, not the package: a manual answers for a whole tree, and only its root carries the `AGENTS.md` that routes into it. So the pass asks its question exactly where a repository is — a `.git` beside the project, a file in a worktree and a directory in a clone — and nowhere else. A fixture directory is not a repository, and neither is a workspace member linted on its own.

Nothing else gates it. A repository with **no** `docs/` at all is not exempt; it is the case the rule exists for, and it fails on `docs/manual-present`.

Why a manual has this shape is language-agnostic doctrine, and it is the estate's, written in [jterrazz-studio's repository structure chapter](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/11-repo-structure.md): the subfolders, the water line between a repository's manual and its brand's wiki. What this chapter owns is the rule ids and what each one refuses. The sentence a rule prints is not here — it lives in the pass, `lint/consumer/checks/docs.ts`, so a page and a gate cannot drift.

<!-- GENERATED:findings docs -->

| Rule                                           | Requirement                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/manual-present`                          | Every repository carries a docs/ manual.                                                                                             |
| `docs/agents-route-to-the-map`                 | The root AGENTS.md routes to the manual's map.                                                                                       |
| `docs/map-present`                             | The manual opens on its map, docs/README.md.                                                                                         |
| `docs/map-matches-chapters`                    | The map links every chapter, and only the chapters there are.                                                                        |
| `docs/map-links-only-chapters`                 | The map links nothing but chapters and decisions/.                                                                                   |
| `docs/chapter-named-by-number-and-subject`     | A chapter is named NN-kebab.md.                                                                                                      |
| `docs/chapters-numbered-contiguously`          | Chapters are numbered without a gap, one number per file.                                                                            |
| `docs/spine-number-reserved`                   | A reserved spine number holds its spine chapter alone.                                                                               |
| `docs/spine-chapters-present`                  | The architecture, developing and testing chapters are present.                                                                       |
| `docs/operating-chapter-present-when-shipping` | A repository that ships an image or a package carries its operating chapter.                                                         |
| `docs/chapter-names-a-subject`                 | A chapter is named for a subject, never for the state of a piece of work.                                                            |
| `docs/no-loose-file`                           | Every file directly under docs/ is the map or a chapter.                                                                             |
| `docs/no-unknown-subfolder`                    | The manual holds no subfolder but decisions/ and _assets/.                                                                           |
| `docs/no-generated-reference`                  | The manual holds no generated API reference.                                                                                         |
| `docs/no-cross-repository-link`                | No link of the manual reaches into another repository's tree.                                                                        |
| `docs/decision-named-by-number-and-subject`    | A decision record is named NNN-kebab.md.                                                                                             |
| `docs/decision-heading-carries-its-number`     | A decision record opens on # ADR-NNN: Title, with its own number.                                                                    |
| `docs/decision-number-unique`                  | One ADR number belongs to one record.                                                                                                |
| `docs/decisions-numbered-contiguously`         | Decision records are numbered from 001 without a gap.                                                                                |
| `docs/decision-status-known`                   | A decision record states a status from the closed vocabulary.                                                                        |
| `docs/decision-listed-in-the-map`              | The decisions folder keeps no hand-written index, no decisions/README.md: the map links the folder, and the records list themselves. |
| `docs/decision-template-present`               | A manual that keeps a decisions folder carries its _template.md in it.                                                               |

<!-- /GENERATED:findings docs -->

Three things about the roster are decisions, not details:

- **The `04-operating.md` presence test is derived, and there is no configuration key.** It fires on a `Dockerfile` (or `Dockerfile.*`), on an `.infrastructure/` directory — either at the repository root or at a workspace member's root, since a monorepo deploys from a member as readily as from its root — or on a root `package.json` that is not `"private": true`. The publishable clause reads the root manifest alone: a private root holding a publishable member is a question for its owner, not a verdict for a gate.
- **The pass only ever REQUIRES a chapter; it never forbids one.** A repository that releases by a tagged workflow and ships neither an image nor a package writes its `04-operating.md` and hears nothing about it. Machine-holding the other half would mean parsing `.github/workflows/**`, which is another repository's shape.
- **The journal-word roster is closed, and it is in the code.** `exploration`, `review`, `notes`, `proposal`, `draft`, `wip`, `old`, `legacy`, `misc`, `todo` — matched as whole words of a chapter's name. No page keeps a second copy of it; the one that matters is executable.

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

A `DocsTree` is a plain description of one repository: the paths under `docs/`, the opening lines of each page, each page's link targets, the root `AGENTS.md`, and the three presence facts. Each violation is a `{ rule, path, message }`. No filesystem, no transport: a sweep across clones nothing has been installed into judges by the same copy of the rules as the gate. `HEAD_LINES` says how far down a page a rule reads, so a `**Status:**` below it is a status the manual does not declare.

## The Oxlint pass

`--type-aware` is passed explicitly and unconditionally. The rules it unlocks are the ones no syntactic linter can express, and a flag that is only sometimes passed is a rule set that is only sometimes enforced. Those rules run in `tsgolint`, a separate binary oxlint looks up on PATH; `oxlint-tsgolint` is a dependency of this package, and the command puts the directory holding it in front of PATH for its own children, so a consumer never installs or configures anything.

The linter is handed the project's files it parses rather than the directory, the same sweep every tree gate reads: every file git does not ignore — tracked, or new and not yet added — and nothing git ignores. A new module is linted before anyone runs `git add`, and a local data folder the gates must not read belongs in `.gitignore`, so the CLI, CI, the baseline and the editor judge one tree. Outside a git checkout the sweep walks the disk. `--ignore-pattern` and the profiles' own ignores still apply on top. A sweep that refused an answer hands the linter the directory instead, so a gate never goes silent on a read it did not make, and the linter is handed the `--ignore-pattern` globs itself, in `check` and in both runs of `fix`: without them, the directory's walk would lint and fix what the operator said to overlook.

### The config it runs with

oxlint finds the project's `oxlint.config.ts` where it looks, and that file is the derived one the [Config pass](#the-config-one-file-pass) holds it to: the config derived from `jterrazz.config.ts` — the platform's profile, each preset's rules, the project's `typescript.oxlint`, and in a workspace each member's own, scoped to its folder ([Lint presets](08-lint-presets.md#how-the-config-is-merged)). Where the file is missing, `check` hands oxlint the same derivation by path, a private entry reading the project root it runs in, so the run lints by the same config while the Config pass names the file to write; left to itself oxlint would walk up the tree for a config and apply whatever the folder the project sits in happens to hold. `baseline` hands the same config, so the ledger records what `check` reports.

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

A fixer that changes MEANING is never applied unattended, so the oxlint run of fix mode turns off each rule marked `unsafe` in the manifest — the rewrite does not land, the diagnostic stays — `fix` and `check` report it alike — and a human answers it. The list, and what each rewrite does, is [Lint presets](08-lint-presets.md).

oxlint has a safe/dangerous split of its own — `--fix` applies the safe fixes, `--fix-dangerously` the rest — and it covers none of the twelve. Measured on oxlint 1.85, each rule alone on a sample that triggers it:

| Rule                                        | oxlint's fix kind                | Plain `--fix` rewrites                                  |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `typescript/consistent-type-definitions`    | `conditional_dangerous_fix`      | yes — a `declare module` interface into a `type`        |
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

So the toolchain keeps its own switch. A mark on a rule with no fixer, or on one oxlint already keeps behind `--fix-dangerously`, would say something false, and this package's own suite refuses it ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#the-rulebook-has-seven-suites)).

The switch is a wrapper config around the one the linter runs with — the project's own, or the default where it keeps none — that the pass writes beside that config and deletes after the run. It goes there and nowhere else, because oxlint resolves `ignorePatterns` and override globs against the directory its config sits in — and every run IGNORES the wrapper's name, so no diagnostic ever names a path the operator cannot open and no tree can ever clear.

That wrapper also stops the run reporting UNUSED DIRECTIVES. Every profile ships `reportUnusedDisableDirectives`, and a run that has just turned twelve rules off cannot judge a directive naming one of them — the rule is off for that run alone, and the directive would be called dead on evidence the wrapper itself created. An unused directive is reported by the check-shaped run made after the fixer, where the consumer's own rules are armed again, and by `check`.

For the same reason the wrapped runs never keep what they write to `.jterrazz/oxlint-suppressions.json`. oxlint rewrites that file on every `--fix` run, dropping each entry whose rule the run did not report — and a wrapped run has twelve rules off. The pass puts the file back as it was after the fixers, and the prune that follows reads it with every rule armed. `@jterrazz/test`'s own fixes, whose wrapper arms the plugin alone, do the same.

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
found: a diagnostic .jterrazz/oxlint-suppressions.json does not hold — each one is listed above · why: … · fix: fix it, or run 'typescript baseline' to record where the project stands — never a bare `oxlint --suppress-all`, which lints with another config · read: docs/07-quality-checks.md#the-ratchet
found: .jterrazz/oxlint-suppressions.json holds more than the project has left · why: … · fix: run 'typescript fix', which prunes the file · read: docs/07-quality-checks.md#the-ratchet
found: .jterrazz/oxlint-suppressions.json holds entries for files that are gone: src/moved.ts · why: … · fix: run 'typescript fix', which prunes the file · read: docs/07-quality-checks.md#the-ratchet
```

The flags that write the file are not in oxlint's `--help` yet; the toolchain pins oxlint to one exact version, and its specs run each one.

### What `.jterrazz/baseline.json` still holds

`.jterrazz/baseline.json` holds what no linter judges — one section per preset, each named by the preset that owns it, `{ "typescript": { … }, "test": { … }, "test.coverage": { … } }` — read, written and judged by one engine, the kit's ([Rules kit](10-rules-kit.md#the-ratchet-engine)), which keeps every section but the one it writes byte for byte. The `typescript` section holds the Architecture (layer map) pass's `architecture/<name>` entries ([its section](#the-architecture-layer-map-pass)), the Names (tree) pass's `names/*` entries ([its section](#the-names-tree-pass)) and the Comments (density) pass's `comments/comment-lines-held-by-the-baseline` ([its section](#the-comments-density-pass)), each judged by its own pass, exactly, with the same four refusals, each printed in four parts under `baseline-ratchet`: a count above its entry, a rule with findings and no entry, a count below its entry, an entry at zero. Each finding prints at its position in the compiler's convention, `src/types.ts:1:1: error names(no-language-construct-name): found: … · why: … · fix: … · read: …`, and a pass whose findings the section records no entry of adds one lesson after them, naming `typescript baseline` as the gesture that records where the project stands. The `test` sections are `@jterrazz/test`'s — its checker passes' counts, and the coverage floor — which that package writes and judges.

An oxlint rule left in the `typescript` section — one recorded before oxlint held its own — is refused in the Oxlint pass under `baseline-moved-to-oxlint`, in four parts, naming `typescript baseline`, which records it in `.jterrazz/oxlint-suppressions.json` and drops the entry. `baseline-unreadable` refuses a `.jterrazz/baseline.json` that is not JSON, or that holds a top-level key whose value is not a section of counts.

`fix` lowers what FELL and never records what grew: it prunes `.jterrazz/oxlint-suppressions.json` — the file goes when nothing is left in it — and the Architecture, Names and Comments passes re-record their own falls, each named in its pass (`re-recorded .jterrazz/baseline.json › typescript › <rule> <was> → <now>`). Debt that grew is written only by `typescript baseline`, by hand.

### Recording it

```bash
typescript baseline
```

A command of its own, because it neither checks nor repairs: it writes down where the project actually stands, debt that grew included. `fix --baseline` would bury that rewrite inside the gesture a developer runs twenty times a day; `fix` records only the falls, which can make the files shrink and never let them grow. It records the lint debt with oxlint — `--suppress-all`, then `--prune-suppressions`, with the config and the sweep `check` lints by, types included — and writes the `typescript` section from the Architecture, Names and Comments passes, then hands both files to the project's own oxfmt: they are tracked like any other file, so the formatter owns their shape. The `test` section is recorded by `@jterrazz/test`'s own command, never by this one. A file this command cannot read as sections is refused rather than rewritten; so is a run whose Architecture (layer map), Names (tree) or Comments (density) pass wrote no report — a pass that could not judge the tree, dependency-cruiser refusing to run included, writes none: that side of the section is unknown, and writing it would erase that debt rather than record it — `typescript check` prints why the pass died. A sweep that refused an answer records no lint debt either, rather than recording the directory.

## The Publish (packaging) pass

This pass refuses a tarball the repository cannot see is broken. A packaging mistake is fatal in the registry: an `exports` entry pointing at a file nobody built, a subpath left out of `files` so it resolves in development and 404s in a consumer, a type declaration a modern resolver cannot see. [The build guard](#the-build-guard) refuses a build that compiles in test material, which works in the registry and ships what no product runs.

It runs once per package the registry would accept — one that names an entry (`exports`, `main`) or a `publishConfig` and never says it is `private`. A private package, and a workspace root that only holds members, have no tarball to be judged on.

<!-- GENERATED:findings publish -->

| Rule                                 | Requirement                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `publish/export-target-exists`       | Every target the exports, main and types fields name exists on disk.        |
| `publish/export-covered-by-files`    | Every target the exports, main and types fields name is published by files. |
| `publish/build-succeeds`             | The build the guard reads succeeds.                                         |
| `publish/no-test-code-in-production` | No shipped file is compiled from test material.                             |

<!-- /GENERATED:findings publish -->

Beside them run `publint --strict` on the packed tarball and `attw --pack . --profile esm-only` on the declarations, and each prints its own report verbatim when it refuses.

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

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) holds the module graph to a layer map. It resolves every import the way the build does — the tsconfig's paths, a package's `exports`, an index file, a relative `../` — so an edge is judged by where it lands, never by how its specifier is spelled; oxlint's `no-restricted-imports` could only read the text. The pass runs where a map is declared — by a preset, the base preset's `lint/` direction included, or by the project — and nowhere else: a project with no declared architecture is not in breach of one.

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
                    read: 'docs/01-architecture.md#layers',
                },
            ],
        },
    },
});
```

A layer is dependency-cruiser's own vocabulary — `from` and `to`, with `path`, `pathNot`, a `$1` naming a group the `from` path captured — plus the three parts of what a refusal teaches: `why`, `fix`, and the `read` a reader opens next. Each violation prints at its import, in four parts, under the id `architecture/<name>`:

```text
src/handlers/orders.ts:2:24: error architecture(handlers-reach-services): found: `src/handlers/orders.ts` imports `src/store/orders.ts` · why: … · fix: … · read: docs/01-architecture.md#layers
```

A project that already keeps a `.dependency-cruiser.cjs`, `.js` or `.mjs` at its root has it extended, not replaced: its own rules run beside the declared ones, and a violation of one prints its `comment` as the why. A cruise starts from every top-level folder the sweep holds a source file in — never a dot-folder, never the ground a spec stands on, which the cruise skips at any depth — so a map judges `app/domain/` as it judges `src/domain/`. A declared map with no such folder to cruise fails the pass in four parts: its silence would read as every boundary kept. The pass is launched wherever a `jterrazz.config.ts` or a `lint/` folder exists and resolves the settings itself, so a map written by shorthand, a spread or an imported object is judged like one written in place. A layer whose `from` names no file of the project is dropped before the cruise: the base preset's laws cost a project without a `lint/` tree nothing. A map the pass cannot read, such as a `jterrazz.config.ts` that does not load or a layer missing one of its six parts, fails the pass in four parts, and so does a dependency-cruiser that cannot run or that stops with no report.

A project that adopts a map its tree already crosses records the crossings with `typescript baseline`: each `architecture/<name>` count goes into `.jterrazz/baseline.json › typescript` and is held exactly, like every count of [the ratchet](#what-jterrazzbaselinejson-still-holds), so a new crossing fails the run and a paid one is re-recorded by `typescript fix`.

A package that ships layers for its consumers hands them in its preset, and a project declaring the preset is held to them beside its own: [Configuration § Presets](06-configuration.md#presets).

### The hexagonal map

`hexagonal: true` adds the map this package ships, six boundaries whose arrow points inward:

- `domain/` imports no other layer.
- `application/use-cases/` and `application/ports/` reach the domain and the ports, never an implementation.
- `infrastructure/inbound/` reaches an outbound adapter through injection, not by import.
- `presentation/ui/atoms/` and `molecules/` stay clear of navigation.
- `presentation/features/<feature>/` reaches no other feature, except `features/common/`.

Each folder matches at any depth, so a workspace member's `src/domain/` is held like the root's. The six are `ARCHITECTURE_HEXAGONAL` in `lint/consumer/checks/architecture.hexagonal.ts`, each with its why and its fix.

### What the pass needs from the tree

`dependency-cruiser` declares a `typescript <7` peer, and this tree satisfies it: the ordinary `typescript` dependency here is the ^6 JavaScript compiler API that perfectionist already needs ([Architecture](01-architecture.md)). That is also why the TS7 Go compiler stays out of `node_modules` under the name `typescript`.

## The Astro (check + format) pass

`.astro` is the one file shape oxfmt does not parse, and `astro check` is the only checker that reads a template's frontmatter. So where a project depends on `astro`, the pass runs both: the project's own `astro check`, and `prettier` over every `.astro` file.

**`prettier` and `prettier-plugin-astro` are dependencies of THIS package**, with a config derived from the oxfmt values — 100 columns, 4 spaces, single quotes, trailing commas everywhere.

The plugin is handed to prettier as a resolved path rather than as a name in the config, because prettier resolves a plugin name from the working directory — and the working directory is the consumer's, which is precisely the project that no longer declares it.

Both halves run in `fix` too: prettier writes, `astro check` is read-only wherever it runs. The pass speaks on success in fix mode alone, because there it rewrote files the operator owns.

## The drift report

Not a pass: a report, printed at the end of every `check`. Four numbers, because the alternative is what the estate had — twenty-eight repositories each quietly a little further from the shared rulebook, and nobody able to say by how much without opening twenty-eight config files.

```text
 DRIFT  Deviations from the profile

  declared                              api on node
  rules off vs profile                  1 (no-console)
  suppressions                          2
  .jterrazz/oxlint-suppressions.json    nothing held
  .jterrazz/baseline.json › typescript  7
  .jterrazz/baseline.json › test        3
  tool versions                         in range
```

A rule set apart, a suppression written, a baseline entry recorded and a tool left behind are the four ways a project drifts — and a preset's law set aside, the fifth, printed as `laws set aside` with each law's name wherever the project keeps one under `optOuts` ([Configuration](06-configuration.md#setting-a-law-aside)). The baseline is named by every section the file keeps — `typescript` always, each other only where the project keeps it — because a count with no section beside it says nothing about which debt it is. A section absent, or holding no entry, reads `nothing held` — the Oxlint pass's words for the same state, so one state has one word. A file the Oxlint pass refuses as `baseline-unreadable` reads `unreadable`: it was never read, so it holds no count the row may claim, not even none. `typescript check --json` prints the same reading for a machine — the block under the `DRIFT` header becomes one JSON object, every pass above it still prints for a human — which is how a fleet-wide sweep collects the table. Its `baseline` is the `typescript` section's total, `null` where the file does not keep it, or `"unreadable"`; `sections` maps every other section of debt the file keeps to its total, and `floors` each section a preset declares a floor to its count of measures — a person reads `a floor of 4 measure(s)`, since percentages summed say nothing; `optOuts` lists each law set aside with its reason. Where a person reads `nothing held`, the machine keeps an absent section (`null`, or no key in `sections`) apart from an emptied one (`0`), because a sweep counting who adopted the ratchet needs the difference.

**The profile is the declared platform's, and what is off is read from the settings.** `declared` names the kind and the platform, or says the project declares nothing and is measured on `node`; `rules off vs profile` counts the rules `typescript.oxlint` turns off, each of which already carries its reason there ([Configuration](06-configuration.md#the-lint-rules)), so the report names them and refuses nothing. `--json` prints the declaration as `declaration`, `null` where there is none, and the rules as `rulesOff`.

The versions line reports only what deviates. The full table is `typescript doctor`'s, and printing it on every run would put a number that changes with every dependency bump in front of a reader looking for what changed in their own tree.

## The Suppressions (directives) pass

Every place the project told a checker to look away. A suppression is a decision, and a decision the next reader cannot re-derive is a defect waiting to be re-introduced, so two rules hold what oxlint does not.

<!-- GENERATED:findings suppressions -->

| Rule                                      | Requirement                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `suppressions/spelled-for-this-toolchain` | A suppression is spelled for the linter this toolchain runs: oxlint-disable, never eslint-disable or biome-ignore. |
| `suppressions/states-its-reason`          | Every oxlint-disable directive states the reason it exists.                                                        |

<!-- /GENERATED:findings suppressions -->

A directive names the rule it silences, then `--` and the reason, on the line above the code it covers — `oxlint-disable-line` puts it at the end of that line instead:

```ts
export function announce(message: string): void {
    // oxlint-disable-next-line eslint/no-console -- the command's one line of output
    console.log(message);
}
```

Turning a rule off for the whole project is `typescript.oxlint`'s, with its reason ([Configuration § The lint rules](06-configuration.md#the-lint-rules)).

A directive is read only where a checker reads one: at the OPENING of a comment. Prose about a suppression, and a string carrying its spelling — the gate's own source is made of both — is not a suppression, and neither oxlint nor tsc would treat it as one.

A directive that suppresses nothing is oxlint's to refuse, not this pass's: every profile ships `reportUnusedDisableDirectives` at `error`, so the Oxlint pass reports each one as an `Unused oxlint-disable directive`. That covers more than the gate could: a rule the config leaves off, a live rule that no longer fires on the next line, a JS plugin's rule, and a plugin rule that no longer exists. The pass keeps only what oxlint does not judge — the spelling of a lint directive and the reason it states. A TypeScript directive is oxlint's too: the rulebook arms `typescript/ban-ts-comment`, which refuses a `@ts-ignore` and a `@ts-expect-error` with no description, so the pass reports neither a second time and only rewrites the first in `fix`.

### What `typescript fix` rewrites

Two spellings, both mechanical. An `eslint-disable*` becomes `oxlint-disable*` when every rule it names is one this project runs, read off `oxlint --print-config` per file, overrides included — a name that means nothing here is a directive whose intent only its author knows. A `@ts-ignore` becomes `@ts-expect-error`, which is the same suppression plus a failure when the error it was covering is gone.

It never invents a reason, and it never deletes a directive: both are the author's judgement, and a rewrite that guessed either would be worse than the report.

## The Markdown (prose) pass

Every `*.md` git does not ignore, outside the ground a test stands on — a `_fixtures/`, `_expected/`, `_seeds/` or `_requests/` folder wherever it sits, another project's tree — is read twice: by [rumdl](https://rumdl.dev), for what Markdown itself defines, and by the prose gate, for what the estate adds.

### What rumdl judges

rumdl is the Markdown linter; the pass hands it the pages and prints its own lines, each at its position — `README.md:5:24: [MD057] Relative link 'notes/design.md' does not exist`. A relative link to a missing file is its MD057, a link to a heading the page does not have its MD051, a fence with no language its MD040. It runs on `src/presets/rumdl/rumdl.toml` unless the project keeps a `.rumdl.toml` of its own, and that preset turns off the rules that judge layout — list indents and markers, line width — because oxfmt writes the layout of a page and two owners of one line would fight. Inline HTML is a form the chapters use (`<details>`), so MD033 is off too. `typescript fix` runs rumdl's own fixes; what it cannot fix stays a finding.

rumdl reads the disk and nothing else, so the check never touches the network. A remote link is not judged here: lychee, the dead-link checker, would need the network, which `make check` never uses, and it ships no npm package to install it with — rumdl's MD057 and MD051 are the offline check of every local link and anchor. A repository that wants its remote links read runs lychee itself, opt-in, where the machine has it: this one's `make check-links` ([Developing](02-developing.md#the-loop)). A link to a file git ignores — a build artefact under `.artifacts/` or `dist/`, a generated reference — is judged like any other: where the file is absent it is refused, which the gate rumdl replaced let through on purpose. That is accepted: the page is read in a clone, and a clone holds no ignored file, so the link is broken for every reader but the one who built it.

### What the prose gate adds

The prose gate reads what no Markdown linter knows: whether a backticked coordinate resolves, whether a skill names a chapter its package ships, and whether a page's blocks breathe.

<!-- GENERATED:findings markdown -->

| Rule                                    | Requirement                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `markdown/path-resolves`                | Every backticked repository path of a page names something on disk, but in a decision record, which names the paths of its day. |
| `markdown/chapter-reference-resolves`   | Every chapter a skill names is one its package ships.                                                                           |
| `markdown/prose-block-is-short`         | A paragraph or a list item runs twelve lines at most.                                                                           |
| `markdown/fenced-run-is-short`          | A fenced block breathes within fifteen lines.                                                                                   |
| `markdown/long-section-has-subheadings` | A section over thirty prose lines is broken by a subheading or a list.                                                          |

<!-- /GENERATED:findings markdown -->

A skill is read from the install, where nothing can correct it, so one more rule reads a page under `skills/` alone: `markdown/chapter-reference-resolves` refuses a `docs/NN-name.md` it names that its package does not ship. The chapter is resolved beside the skill's own `skills/` folder, the package root it is published from.

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

All three rosters are closed, and the base preset carries them ([Configuration](06-configuration.md#the-base-preset)): one executable copy, read by the gate from the resolved settings. Grab-bag: `base`, `common`, `helpers`, `lib`, `misc`, `stuff`, `tools`, `utils`. Construct: `constants`, `helper`, `interfaces`, `type`, `types`, `util`, and the `.types.ts` suffix — a word the grab-bag already refuses is reported once, under that roster. A leading `_` excuses no word of either roster: it states a position, not a subject, so `_utils/` is refused as `utils/` is. Shortcut: `auth`, `cfg`, `impl`, `infra`, `k8s`, `pkg`, `repo`, `repos`, `svc`, `tmp` — and the `_` marker does NOT excuse one, since it states a position, not whether the name is whole.

A construct is judged on the WHOLE name: `type-registry.ts` names a subject and passes, `types.ts` names a part of the language and fails. Two words stay off the rosters though they sound generic, because each names a role a reader recognises at once: `setup` is what a runner loads before a test (`vitest.setup.ts`, a `setupFiles` entry), and `core` is the part of a layered tree every other layer depends on. An `index[.<subpath>][.browser].ts` is the entry of a subpath the package publishes ([the entry grammar](#the-entry-grammar)), and no roster holds it. The ground a spec stands on is never swept at all, so a fixture may be called anything its scenario needs.

### The entry grammar

A package that publishes a build names each entry for what it publishes, so the tree says which file a consumer's `import` lands on without the manifest open. The source a subpath is built from is `index[.<subpath>][.browser].ts`: `.` from `index.ts`, `./config` from `index.config.ts`, `./rules` under its `browser` condition from `index.rules.browser.ts`, a nested subpath with a dot for each slash. `node` is the default runtime, never a variant, so no entry is named `.node`. A bin the build compiles is `<command>.bin.ts`, named for the command a consumer types: `typescript` from `typescript.bin.ts`. A module the package's own code loads by path — a program it spawns, a plugin a tool loads — is a private entry: it is declared as a `#` import in the manifest's `imports`, `#checker` built from `index.checker.ts`, and named by the same grammar.

The pass reads the `exports`, `imports`, `main` and `bin` targets under the build's output folder, and maps each to its source through the mapping the build compiles by: each published target from its entry under `src/` or at the root of `lint/`, named by this grammar ([Building](09-building.md#the-entries)). A pattern subpath (`./tsconfig/*`) publishes a folder, not an entry, and a target outside the build that is not code (a JSON preset) is no compiled entry: neither is judged. In a package that publishes a build, a bin, or a `.js`, `.cjs` or `.mjs` module, published from outside it is code no source compiles, and is refused; a package that builds nothing publishes its JavaScript as written.

- `names/entry-follows-its-grammar` refuses an entry named otherwise, at the source.
- `names/index-is-an-entry` refuses a module under `src/` or `lint/` named `index` that builds nothing the package publishes — its test passes beside the entry it tests. A module that composes others for the package's own code is named for what it composes.
- `names/export-has-an-entry` refuses a published target the build compiles from no source it names, and, in a package that publishes a build, a bin or a module published from outside it.
- `names/bin-is-published` refuses a module under `src/` or `lint/` named `<command>.bin` that builds no bin the package publishes.

A package of the family states one more convention, which the gate does not read: a subpath that configures a tool is named for that tool's config file — `./config` is read by `jterrazz.config.ts`, `./oxlint` by `oxlint.config.ts`, `./vitest` by `vitest.config.ts` — so a consumer finds the import in the file named for it.

### What ls-lint judges, and what stays the gate's

Where a name sits is declarative, so [ls-lint](https://ls-lint.org) judges it: the pass writes an ls-lint config from the tree this chapter describes, runs it over the disk, and prints each failure as the rule below that owns it — every directory under a named root in kebab-case (`names/directory-in-kebab-case`), the closed folder lists and root files of [the lint tree](#the-lint-tree), and a skill holding nothing beside its `SKILL.md`. A leading `_` is a folder the toolchain owns (`_fixtures/`, `_setup/`), and a route segment keeps its framework's grammar — `[id]`, `[[...slug]]`, `(group)`, `@slot` — so a Next.js or Astro tree passes as written. The ground a test stands on, `node_modules/`, `dist/` and every dot-folder are left out, and so is what an `--ignore-pattern` names. ls-lint reads the disk, so its failures are read against the sweep the other rules judge: a path git ignores is never named, and a directory it refuses is named only when it holds a file git sees. A file ls-lint never looks at — one with no extension, such as a `README` or a `LICENSE`, or a dot-file — is judged by the gate itself wherever a folder is closed, at the root of `lint/`, of an audience folder, of `skills/` and of a skill, under the same rule ids.

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

Three limits are ls-lint's, and a rule is written around them. Its extension is everything after a name's first dot, so `a.b.spec.ts` carries `.b.spec.ts`: a rule about every spec writes `.spec.ts` and `.*.spec.ts`. It never judges a file at the root it runs from, so a rule about a unit's root files is not one ls-lint can hold. And it anchors a `regex:` as written, `^` before it and `$` after, so an alternation is wrapped in a group — `regex:(?:index|main)` — or its first branch is held only at the start and its last only at the end. Within one rule, two globs matching the same directory are judged in no stable order, so a rule's globs never overlap. A rule the pass cannot read — a `name` not in kebab-case, an `ls` that does not map each glob to its rules, a missing lesson part — is refused as `names/jterrazz-config-loads`, and a glob ls-lint cannot read fails the pass in four parts. A package's name rules arrive the same way through its preset ([Configuration § Presets](06-configuration.md#presets)).

### The root spine

The **root spine** is the folders a repository root holds, the same in every repository: `src/` the product's code, `lint/` the lint rules a package ships, `specs/` the specifications, `docs/` the manual, `skills/` one short page per skill — and `apps/` or `packages/` where a workspace keeps its members, each a spine of its own. What the tree calls a root is therefore judged too. The table holds the whole `tree` family: the spine's rules, and those of [the lint tree](#the-lint-tree) and [an empty directory](#an-empty-directory) below. The family names what a rule judges; the prefix names the pass that prints it, and the Names pass prints both families, so a `tree` rule reads `names/…` like a `names` one.

<!-- GENERATED:findings tree -->

| Rule                                     | Requirement                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `names/no-undeclared-root-folder`        | Every root folder is on the root spine, imposed by a tool, or declared with its reason.                                                               |
| `names/declared-root-states-its-reason`  | A root declared in typescript.roots states why the repository keeps it.                                                                               |
| `names/declared-root-holds-files`        | A root declared in typescript.roots holds a file git does not ignore.                                                                                 |
| `names/jterrazz-config-loads`            | The settings file jterrazz.config.ts loads, and its typescript section has the declared shape.                                                        |
| `names/skill-holds-only-skill-md`        | A skill is one skills/<skill>/SKILL.md and nothing beside it.                                                                                         |
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

A skill is hand-written and read from the install, so anything beside its page — a file or a folder — is a second copy of a chapter or a projection of something the package already owns. A dot-folder (`.github/`, `.vscode/`) is the tools', never the spine's, and is not judged.

`lint/` stands on the spine only where the package SHIPS it, and it ships it one of two ways. Directly: an entry of its `package.json`'s `files`, or a target of its `exports`, reaches into `lint/`. Or through its build: a target the build compiles from a `lint/` source ([Building](09-building.md#the-entries)) is published by an `exports`, `bin` or `main` target, or by a `files` entry no later `!` entry takes back. A package that ships its rules as `dist/oxlint.js`, built from its `./oxlint` entry under `lint/` ([the entry grammar](#the-entry-grammar)), is the case the second way exists for.

A `lint/` nothing publishes holds rules no consumer receives — `src/` under another name — and is refused as `names/no-undeclared-root-folder`. The build config is read as text, never run: an entry is named for its key, `oxlint: 'lint/index.oxlint.ts'`, or for its file where it has none.

A workspace member is a spine of its own, judged the same way from its own folder: its first-level folders owe the spine, its `lint/` answers to its own `files`, `exports` and build, and it declares the roots it keeps beyond the spine in its own `jterrazz.config.ts`. The `Makefile` stays the repository root's.

#### The six gestures

Every repository answers the same six at its root, whatever the language under it: `make install`, `make build`, `make lint`, `make fix`, `make test` and `make check`. The flows speak only these, so a session that has never opened the repository still knows how to install, prove and repair it. What each recipe runs is the repository's, save how `fix` meets a failure; that the rule exists is the contract.

The contract is asked where a REPOSITORY is — a `.git` beside the project, as for [the Docs (layout) pass](#the-docs-layout-pass) — and an ignored `Makefile` counts for none, like every path a tree gate skips. A workspace member owes nothing: the repository's root answers for every member, and a member linted on its own is never asked.

A target counts when the `Makefile`'s own text writes a rule for it — `lint:`, `install build:`, `test::` — and an assignment (`LINT := …`) or a comment is no rule. A file the `Makefile` `include`s is not read, so the six stay written where a reader opens first.

`fix` runs every fixer the repository has. A preset's fixers run inside `typescript fix`, before the formatter ([A preset's checks](#a-presets-checks)), so a repository on the toolchain alone writes it as one line:

```make
fix:
	npx typescript fix
```

A repository with fixers of its own outside the toolchain runs them in one shell and carries the verdict to its end, `typescript fix` last: Make stops a recipe at its first failing line, and a fixer failing on debt it cannot settle would otherwise keep the formatter from the files it had just rewritten.

The pass reads that the rule exists, never what it runs, so this one is the chapter's to state and the repository's to keep.

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

The second ground is that saying: the repository declares the root in its settings file, `jterrazz.config.ts`, under `typescript.roots`, each with its reason ([Configuration](06-configuration.md#the-typescript-section)).

```ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

The file holds one section per package of the family, each package reading only its own, so a root declared anywhere else — a `jterrazz` key in `package.json` included — is not read. A file that does not load, or whose `typescript.roots` is not an object mapping each folder to its reason, is refused as `names/jterrazz-config-loads`, and the roots it meant to declare stand undeclared until it is fixed. The reason is not decoration: an entry without one is refused (`names/declared-root-states-its-reason`), and an entry whose folder holds no file git does not ignore is refused too (`names/declared-root-holds-files`), so the list shrinks as the tree does. A base package that composes others keeps its broader roots through this same declaration, never through an exemption in the gate.

### The lint tree

`lint/` has one tree in every repository that keeps one, whatever the package: its entries at its root — each `index[.<name>].ts` ([The entry grammar](#the-entry-grammar)), built as a subpath the package publishes or a private `#` import, the one place a declaration meets the kit — and one folder per audience — `consumer/`, the declarations every consumer is held to; `self/`, the declarations only the repository is held to; `kit/`, what runs them and knows none — each holding what [Architecture](01-architecture.md#the-judging-layer) says it holds. A reader who knows one repository's `lint/` knows every one, so the pass holds each unit that keeps a `lint/` to it, a workspace member included.

- `names/lint-root-holds-only-entries` refuses a file at the root of `lint/` that is not an entry — a `README`, a `.json`, a page, a module not named `index[.<name>]`.
- `names/lint-folder-is-known` refuses a folder of `lint/` outside the three.
- `names/consumer-folder-is-known` refuses a folder of `consumer/` outside `catalogue/`, `rulebook/`, `rules/` and `checks/`, and a file at its root.
- `names/self-folder-is-known` refuses a folder of `self/` outside `catalogue/`, `rules/`, `checks/` and `corpus/`, and a file at its root but a module composing the self declarations with the kit.
- `names/kit-folder-is-known` refuses a folder of `kit/` outside `project/`, `baseline/`, `checker/`, `catalogue/`, `compiler/` and `testing/`, and a file at its root.
- `names/audience-holds-only-declarations` refuses a module of `consumer/` or `self/` that runs as a program, or that hands another module a function or a value named for something other than its file.
- `names/rule-file-in-its-family-folder` refuses a rule file of `consumer/rules/` or `self/rules/` filed at the root of `rules/`, or under a folder its catalogue row does not name.

A declaration is a rule, a check, a decision on an upstream rule, a catalogue entry, or their tests, and the pass knows one by what its module exports and who reads it: each function or value it hands another module carries its file's name — one dotted part of the file's name, hyphens and underscores dropped, is part of the export's, whatever the case — so `no-snapshot-folder.ts` may export `checkNoSnapshotFolder`, `docs.js` exports `auditDocs`, and `import.js` hands the framework fragments `IMPORT_ASSETS`. A value a module of a `catalogue/` exports is a row every declaration reads, and a value a module at the root of `lint/` — or of `self/` — imports is what that module composes: both are free. What only the module's own test imports is the declaration's own, whatever its name. Types and the default export are free, and so is a file that is not a module, a test, or anything under `_expected/` or `_fixtures/`. A part, `<name>.<part>.<ext>` beside its `<name>.<ext>`, is that declaration cut in two, and it and the declaration read each other freely. A module handing another a function or a value named for anything else is a helper, and the kit owns the code declarations share. A module that reads `process.argv`, imports `argv` or `exit` from `node:process`, calls `process.exit`, or runs under `import.meta.main` is a program, and the checker under `kit/checker/` is the one program a declaration runs through. The modules are read as text, never run: a reader is any module of the unit that imports the file by a relative path, and it takes the names its import lists — every name, for a namespace or a dynamic import.

The family is read off the unit's own catalogues: every file directly under `lint/consumer/catalogue/` or `lint/self/catalogue/`, read as text and never run, where a row is any object literal stating an `id` or a `name` and a `family` — a JSON row and a TypeScript manifest row alike, the plugin prefix of an id left aside. A rule file is matched to its row by its name, its test with it. A unit with no catalogue, or a rule no row names, is held to the other rules alone: a family is never guessed.

### An empty directory

The tree is judged on the disk as well as by its names. git tracks no directory, so an empty one exists only on the machine that holds it — a folder a fixer or a move emptied, a scaffold nobody filled — and it tells the next reader of that disk about a part of the tree that is not there. `names/no-empty-directory` refuses a directory holding no file at any depth that git does not ignore.

A directory holding only empty directories is empty, and is named once, at its top. The walk never enters `.git/`, a directory holding a `.git` of its own, or a folder no gate reads — `node_modules/`, `.artifacts/`, `dist/` and the rest the sweep leaves out — and a directory git ignores, or an `--ignore-pattern` names, is left alone. The finding states itself in four parts, `found: … · why: … · fix: … · read: …`.

`typescript fix` deletes each one before it judges the tree, printing a `removed` line per directory, and renames nothing else. It deletes bottom-up, one empty directory at a time, so a file that landed in one since the walk stops the deletion rather than going with it. CI never meets the rule: a fresh clone holds no empty directory.

### What the ratchet records

Every rule is printed and recorded as `names/<rule>`, and carries the code `names(<rule>)`: `typescript baseline` writes the pass's counts into the `typescript` section of `.jterrazz/baseline.json`, which holds only the `architecture/`, `names/` and `comments/` counts, while the linter's debt lives in `.jterrazz/oxlint-suppressions.json`. Where the section holds a `names/*` entry, this pass is judged by it exactly, with the four refusals of [the ratchet](#the-ratchet), and `typescript fix` re-records the entries that fell. A project adopting the construct roster records its existing sites once and renames them by domain, one entry at a time.

## The Comments (density) pass

The default is no comment: the code speaks through its names, and a name that needs a comment is renamed instead. So the number of comment lines a project holds is held exactly, like a debt — a new one is a decision someone records, never a drift nobody saw.

**What is measured.** Every source file the Oxlint pass lints — a `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.astro`, `.vue` or `.svelte` that git does not ignore, tests included — outside the ground a test stands on and every `--ignore-pattern`. A file whose first five lines carry `@generated` is a tool's output, not the project's prose, and is skipped; so is every Markdown page, which is documentation, not a comment.

**What a comment line is.** A physical line that any comment covers — a `//` line, a trailing `//` after code, and every line a `/* … */` block spans, its opening and closing lines included — read by the same reader the Suppressions pass reads directives with, so a `//` inside a string or a template is never one. A line whose only comment is a directive (`oxlint-disable*`, `eslint-disable*`, `@ts-expect-error`, `@ts-ignore`, `biome-ignore`) is not counted: a directive is the Suppressions pass's, and the reason it carries is required there. Nor is a test's `// Given - `, `// When - ` or `// Then - ` marker: `@jterrazz/test` requires it of every test, so it is structure, and adding a test never moves the count. Nor is an instruction another tool reads — a formatter's `oxfmt-ignore` or `prettier-ignore`, a coverage tool's `v8 ignore` or `c8 ignore`, a bundler's `@vite-ignore`: the count is prose alone.

<!-- GENERATED:findings comments -->

| Rule                                                      | Requirement                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `jterrazz-typescript/comment-no-longer-than-its-function` | A comment run above a function is no longer than the function it documents.           |
| `comments/comment-lines-held-by-the-baseline`             | The count of comment lines a project holds is exactly the count its baseline records. |

<!-- /GENERATED:findings comments -->

The count is recorded as `comments/comment-lines-held-by-the-baseline` in the `typescript` section of `.jterrazz/baseline.json`, and judged with the four refusals of [the ratchet](#the-ratchet): a count above the entry, a count and no entry, a count below it, an entry left at zero. `typescript fix` lowers the entry to a count that fell, and drops it at zero; only `typescript baseline` raises it, by hand, for a comment that states what the code cannot. The finding states itself in four parts, `found: … · why: … · fix: … · read: …`, and its `found` gives the density — the lines, and their share of the measured source.

## The Secrets (credentials) pass

No file the project would commit carries a live-looking credential. Two scanners answer that one question, over the same files — every one git does not ignore, the ground a test stands on and `--ignore-pattern` left out, as for every tree gate. Where `gitleaks` is on PATH it runs as `gitleaks dir . --no-banner --redact` over a copy of exactly those files, so a finding names the file and never reprints the secret; where it is not, ten patterns over their text answer well enough to stop the leak that actually happens — a token pasted into a note and committed with it.

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
typescript mutation                                     # the module tests, against mutants of src/ and lint/
typescript mutation --specs --mutate src/a.ts:10-20     # the whole suite, against mutants of the lines named
```

Not a pass and never part of `check`: [Stryker](https://stryker-mutator.io) rewrites the sources one mutant at a time and asks whether a test fails, which says what the coverage number cannot — whether a line the tests run is a line they judge. The command derives Stryker's config and the Vitest config it runs into `.artifacts/stryker/`, and a project keeps neither: Stryker and its Vitest runner are this package's dependencies. The default run mutates `src/` and `lint/` against the `unit` project, incrementally; `--specs` runs every project but the browser ones against a build of each mutant, which is slow enough that the run names the ranges it measures, and is refused without them.

What a run leaves out is declared under `typescript.mutation`, each path mapped to its reason: `exclude` the tests that read the sources as text, and see the instrumented ones, and `ignore` the sources no test of the package can judge.

The run is in place, since the checks a test runs read the git tree and a sandbox under the ignored `.artifacts/` is invisible to them. One file therefore lands at the root: Stryker's Vitest runner writes `stryker-setup-<worker>.js` into the working directory of each test runner — the project root, in place — and offers no option to move it. It removes the file when the run ends; a run that stops early leaves it behind, so a repository running mutation ignores `stryker-setup-*.js`, the one regenerable name its root may hold.

## Pitfalls

- **A nested `oxlint.config.*` is loaded only on the path of a file oxlint is handed.** `check` hands it the sweep, which never holds the ground a test stands on, so a config committed under `_fixtures/` is never read, armed or broken. Handed a directory instead — the fallback when the sweep could not answer — oxlint discovers every config beneath it and loads them all before it lints anything, and one that cannot load fails the run.
- **An ignore without a reason is the expected form of nothing.** Every entry under `typescript.knip` tells the gate to overlook something, and the next reader would have to re-derive why — so each one maps to its reason ([Lint presets](08-lint-presets.md#unused-code-knip)).
- **An export used in its own file is not dead.** The base preset sets `ignoreExportsUsedInFile: true`, so the `cleanup-passed-to-after-all` idiom's same-file `cleanup` and a capsule's flags read back by its sibling test never need a `typescript.knip` line to stay unreported.
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.
- **Knip runs uncached, on purpose.** Its `--cache` would be the obvious speed-up and it can lie: a cached glob is validated against the mtimes of the directories that held a match, so a file added to a directory that held none is invisible, and the cached run passes a project the uncached run fails. Every other cache in the toolchain — tsc's buildinfo — is keyed on content and cannot.

## Related

- [Lint presets](08-lint-presets.md) — the rulebook, how the config merges, knip.
