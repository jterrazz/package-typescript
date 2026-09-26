# Quality checks

`typescript check` runs every quality gate in parallel; `typescript fix` auto-repairs what it can.

Every pass that RAN prints the same block, in one fixed order: a `RUN` header carrying its name, whatever it has to say, and one verdict line. A pass that did not apply — no Astro in the project, no declared layer map — prints nothing at all, because it answered no question.

What sits between the header and the verdict is the one variable. A failing pass prints its whole captured log; a passing one stays silent, unless it WROTE something — `fix` changed a file the operator owns, and silence would hide that — or a ratchet held it, which the Oxlint pass states in one line ([the ratchet](#the-ratchet)). A tool's success chatter never reaches the stream, so a green run is byte-identical on every platform.

The order is the table below, top to bottom, and the drift report closes the run.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package gate once per member, and a single-package project is the same run it always was.

## The passes

`typescript check` runs up to fifteen passes. Three spawn a tool on every invocation, knip and five tree gates run on every `check`, and the other six are opt-in — they appear only when the project qualifies.

| Pass                              | Tool                        | When it runs                                                             |
| --------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| TypeScript Check                  | tsc (TypeScript 7, Go)      | always                                                                   |
| Oxlint Check                      | oxlint (`--type-aware`)     | always (judged by the ratchet's `typescript` section where there is one) |
| Oxfmt Check                       | oxfmt (Rust)                | always                                                                   |
| Gitignore (artefacts)             | the artefact gate           | check: project or ancestor `.gitignore`; fix: project's own              |
| Knip (unused code)                | knip (Node)                 | always (check only — it is not run in fix)                               |
| Test Conventions (@jterrazz/test) | conventions checker         | per `specs/` root; per member resolving `@jterrazz/test`                 |
| Docs (layout)                     | the manual gate             | check: at a repository root (a `.git` beside the project)                |
| Publish (packaging)               | publint + attw + a build    | per package the registry would accept (not `private`)                    |
| Architecture (layer map)          | dependency-cruiser          | check: a `.dependency-cruiser.*` at the project root                     |
| Astro (check + format)            | astro check + prettier      | per project that depends on `astro` (check and fix)                      |
| Suppressions (directives)         | the suppression gate        | always (check and fix — `--fix` settles two spellings)                   |
| Markdown (prose)                  | the prose gate              | always (check only — a paragraph is not machine-split)                   |
| Names (tree)                      | the naming gate             | always (check and fix — `--fix` deletes an empty directory)              |
| Comments (density)                | the comment gate            | always (check and fix — `--fix` re-records a fall)                       |
| Secrets (credentials)             | gitleaks, else the patterns | always (check only — a leak is rotated, not reformatted)                 |

`typescript fix` runs tsc, oxlint (`--fix`), oxfmt, the artefact gate, the suppression gate, the naming gate and the comment gate — knip, the conventions checker, the Docs (layout) pass and the remaining tree gates are check-only (they are read-only gates, not fixers).

### In a workspace

When the `package.json` at the cwd declares `workspaces`, the per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/package.json` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed.

The Docs (layout) pass measures from neither: its unit is the repository, and the section below says why.

The other four passes are root-only, and that is not an omission. tsc, oxlint and oxfmt measure from their **config file**, not from a package, and each already reaches the whole tree from the cwd — oxlint and oxfmt through the project's files they are handed. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

Discovery never leaves the workspace. A candidate is dropped when git ignores it — clones, workbenches and build output live under gitignored paths — and when the walk had to cross a nested `.git` or a `package.json` that no workspace glob claims to reach it: a vendored project's conventions are its own, not yours.

## The Gitignore (artefacts) pass

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root ([Developing](02-developing.md)), and this pass reads that convention off two files: the project's own `.gitignore`, and the nearest ANCESTOR `.gitignore` above it — the workspace root's, found by walking up to the nearest directory holding a lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `npm-shrinkwrap.json`) or a `workspaces` manifest. That walk stops at the nearest repository boundary and never passes it — a `.git` directory in a clone, a `.git` file in a worktree — because a clone checked out inside another repository is not a member of the tree it sits in, and the `.gitignore` above that boundary answers for somebody else's artefacts. A project carrying its own `.git` therefore has no ancestor at all. It runs when either file exists — a project with neither names no artefact path — and each is judged by the same rules.

The second file matters in a workspace whose `lint` DELEGATES to members — each one calling `typescript check` on its own, cwd'd there. Without it, a member with no `.gitignore` of its own would pass silently even when neither it nor the root ever declared the convention: the pass is opt-in on a file's existence, and only the package's own file used to be asked. An ancestor's pattern counts only when it is not ANCHORED to the ancestor's own directory — `.artifacts/`, not `/.artifacts/` — the same rule git applies when deciding whether a pattern reaches into a nested directory; a root that ignores `.artifacts/` this way covers every member beneath it.

Three things fail it:

- **An artefact named outside `.artifacts/`** — `*.tsbuildinfo`, `.next` (see the conditional exception below), `out`, `build`, `coverage`, `target`, `test-results`, `playwright-report`, a `*.log`, `.vite`, `.cache`, or `bin/` (a Go output). The message names the `.artifacts/<tool>/` home each one moves to, and which file — the project's own or the ancestor's — named it. A pattern is read by the segment that carries its meaning, so `packages/*/coverage` and `coverage/` fail alike.
- **`.artifacts/` not ignored by either file** — the convention's own directory must never reach a commit. When a workspace root exists, the message points at it — that is the shared file the fix belongs in.
- **A committed artefact** — a tracked `*.tsbuildinfo`, or a tracked file under `.artifacts/`, `.next/`, `.turbo/`, `.vite/`, `.cache/`, `coverage/`, `playwright-report/` or `test-results/`. The remedy is `git rm --cached`, and it stays yours: the pass never deletes a file git is tracking.

`dist` is the one exception the convention itself carves out — a build's product stays beside `src/` and is published from there.

### The closed exception list

These ignored paths are not artefacts of the convention, and the pass says nothing about them: `.expo/`, `ios/`, `android/`, `next-env.d.ts`, `.vercel`, `.build/`, `.swiftpm/`, `Package.resolved`, `DerivedData/`, `.gradle/`, `.metro-health-check*`, `.turbo/`, `node_modules/`. Each is a platform working directory a toolchain owns and cannot be told to move, or a file a framework expects at a fixed path. The list is closed: a path that is not on it and matches an artefact form fails.

`.turbo/` is the one member a tool moves only HALF of: Turborepo pins its per-task log at `<package>/.turbo/turbo-<task>.log` with no key, flag or environment variable to relocate it, while its cache obeys `cacheDir` and still belongs at `.artifacts/turbo/`. Ignoring the directory is granted; committing what it holds is the tracked-file failure above.

One more exception joins the list CONDITIONALLY: `.next`, but only when the project's `next.config.*` declares `output: 'export'`. In that mode Next reads `distDir` as the export destination and keeps its working directory pinned at `.next` regardless — `next/dist/export/utils.js`'s `hasCustomExportOutput` refuses to move it, proven by a real consumer's static site. The pass reads the config file textually for `output:\s*['"]export['"]`; without a match — including when there is no `next.config.*` at all — `.next` stays an ordinary artefact whose home is `.artifacts/next/`.

### What `typescript fix` rewrites

Fix mode rewrites the package's OWN `.gitignore` only — never an ancestor's, which is a different project's file, and never one that does not exist, since fix repairs a file, it does not create one. The artefact lines go, `.artifacts/` arrives, and everything else — the comments, the blank lines, the order, the project's own paths — survives untouched. It reports every line it removed and prints the file's negations, which it never touches: a `!` line rescues a tracked file, so what to do with one is a judgement, not a rewrite. A committed artefact is reported in fix mode too and still fails the run — untracking a file is not something a formatter should decide.

## The Test Conventions pass

`@jterrazz/test` ships the checker; this package runs it, and the question it answers is "does this project write specs the way the framework says". It runs in two shapes, and both are needed because they answer for different things.

One run per `specs/` root the workspace owns — the root's own, plus the first one found at or below each member — judging the tree: the document grammar, the fixtures, the goldens. And one run per workspace MEMBER, `--member <dir>`, judging what the member has rather than what its specs tree holds: a package with a `test` script and no `vitest.config.ts` owns a question no specs root can be asked, and a package with no `specs/` at all was previously never reached.

A member is a consumer of `@jterrazz/test` on either evidence: its own manifest names it, or it RESOLVES one from an ancestor — which is what npm makes of a monorepo, where a workspace declares the dependency once at the root and every member loads it. The resolution is the ancestor walk itself, `node_modules/@jterrazz/test/package.json` from the member upward, rather than `require.resolve`: the package's `exports` map does not publish `./package.json`, and a gate does not depend on a map the package is free to change. The walk stops at the nearest repository boundary, so a clone sitting inside another tree is never made a consumer by what the tree around it installed.

The binary is resolved from that same install, not from a name on `PATH` or a `node_modules/.bin` shim: a member whose `@jterrazz/test` is nested rather than hoisted holds a different release from the root's, and both halves of the question — which version, which executable — must come from one answer.

The pass's verdict is the checker's exit code, and nothing here forgives it: `@jterrazz/test` records its own debt and judges it, in its own section of the ratchet file ([the ratchet](#the-ratchet)).

A green pass says one thing about that section: the held line of the run over the project root, `jterrazz.baseline.json › test: <n> held across <k> rules` — or `jterrazz.baseline.json › test: nothing held` for a project keeping no `test` section — the shapes the Oxlint pass gives its own. `@jterrazz/test` 17 prints that line bare on every green ratchet run, so the pass passes no flag to ask for it; a line in any other shape is left out rather than echoed as a second shape.

The member runs judge the `jterrazz(*)` diagnostics the oxlint pass sets aside, and they read them off that pass's own report: `check` writes oxlint's JSON report once and hands it to every member run with `--oxlint-report <path>`, starting those runs once the report is complete. The checker prints a count of those diagnostics, not the diagnostics: where a run fails on them, the Oxlint pass prints each one ([one run, and the log drawn from it](#one-run-and-the-log-drawn-from-it)). A tree run reads no oxlint diagnostic and is handed nothing. A checker started by hand, with no report, runs oxlint itself — so `check` never lints the project a second time for the checker.

## The Docs (layout) pass

Every repository carries the same manual — a map at `docs/README.md`, a fixed spine, and its own chapters numbered contiguously after it — and this pass refuses a tree that breaks it.

Its unit is the **repository**, not the package: a manual answers for a whole tree, and only its root carries the `AGENTS.md` that routes into it. So the pass asks its question exactly where a repository is — a `.git` beside the project, a file in a worktree and a directory in a clone — and nowhere else. A fixture directory is not a repository, and neither is a workspace member linted on its own.

Nothing else gates it. A repository with **no** `docs/` at all is not exempt; it is the case the rule exists for, and it fails on `docs/manual-present`.

The spine itself is language-agnostic doctrine, and it is the estate's, which [Repo structure](08-repo-structure.md) routes to: the four fixed names, the subfolders, the water line between a repository's manual and its brand's wiki. What this chapter owns is the rule ids and what each one refuses. The sentence a rule prints is not here — it lives in the engine, so a page and a gate cannot drift.

<!-- GENERATED:findings docs -->

| Rule                                           | Requirement                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/manual-present`                          | Every repository carries a docs/ manual.                                     |
| `docs/agents-route-to-the-map`                 | The root AGENTS.md routes to the manual's map.                               |
| `docs/map-present`                             | The manual opens on its map, docs/README.md.                                 |
| `docs/map-matches-chapters`                    | The map links every chapter, and only the chapters there are.                |
| `docs/map-links-only-chapters`                 | The map links nothing but chapters and decisions/.                           |
| `docs/chapter-named-nn-kebab`                  | A chapter is named NN-kebab.md.                                              |
| `docs/chapters-numbered-contiguously`          | Chapters are numbered without a gap, one number per file.                    |
| `docs/spine-number-reserved`                   | A reserved spine number holds its spine chapter alone.                       |
| `docs/spine-chapters-present`                  | The architecture, developing and testing chapters are present.               |
| `docs/operating-chapter-present-when-shipping` | A repository that ships an image or a package carries its operating chapter. |
| `docs/chapter-names-a-subject`                 | A chapter is named for a subject, never for the state of a piece of work.    |
| `docs/no-loose-file`                           | Every file directly under docs/ is the map or a chapter.                     |
| `docs/no-unknown-subfolder`                    | The manual holds no subfolder but decisions/ and _assets/.                   |
| `docs/no-generated-reference`                  | The manual holds no generated API reference.                                 |
| `docs/no-cross-repository-link`                | No link of the manual reaches into another repository's tree.                |
| `docs/decision-named-nnn-kebab`                | A decision record is named NNN-kebab.md.                                     |
| `docs/decision-heading-carries-its-number`     | A decision record opens on # ADR-NNN: Title, with its own number.            |
| `docs/decision-number-unique`                  | One ADR number belongs to one record.                                        |
| `docs/decisions-numbered-contiguously`         | Decision records are numbered from 001 without a gap.                        |
| `docs/decision-status-known`                   | A decision record states a status from the closed vocabulary.                |
| `docs/decision-listed-in-the-map`              | The decisions folder keeps no hand-written index; the map lists the records. |
| `docs/decision-template-present`               | The decisions folder carries its _template.md.                               |

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

The engine is a pure function, exported at `@jterrazz/typescript/docs`:

```ts
import { auditDocs } from '@jterrazz/typescript/docs';

const violations = auditDocs(tree); // -> [{ rule, path, message }, …]
```

`tree` is a plain description of one repository — the paths under `docs/`, the opening lines of each page, each page's link targets, the root `AGENTS.md`, and the three presence facts. No filesystem, no transport: a sweep across clones nothing has been installed into judges by the same copy of the rules as the gate. `HEAD_LINES` says how far down a page a rule reads, so a `**Status:**` below it is a status the manual does not declare.

## The Oxlint pass

`--type-aware` is passed explicitly and unconditionally. The rules it unlocks are the ones no syntactic linter can express, and a flag that is only sometimes passed is a rule set that is only sometimes enforced. Those rules run in `tsgolint`, a separate binary oxlint looks up on PATH; `oxlint-tsgolint` is a dependency of this package, and `check.sh` puts the directory holding it in front of PATH for its own children, so a consumer never installs or configures anything.

The linter is handed the project's files it parses rather than the directory, the same sweep every tree gate reads: every file git does not ignore — tracked, or new and not yet added — and nothing git ignores. A new module is linted before anyone runs `git add`, and a local data folder the gates must not read belongs in `.gitignore`, so the CLI, CI, the baseline and the editor judge one tree. Outside a git checkout the sweep walks the disk. `--ignore-pattern` and the profiles' own ignores still apply on top. A sweep that refused an answer hands the linter the directory instead, so a gate never goes silent on a read it did not make, and the linter is handed the `--ignore-pattern` globs itself, in `check` and in both runs of `fix`: without them, the directory's walk would lint and fix what the operator said to overlook.

### The config it runs with

A project that keeps an oxlint config at its root — `oxlint.config.ts`, `.mts`, `.mjs`, `.js` or `.cjs`, `.oxlintrc.json` or `.jsonc` — is linted by it, and oxlint finds it, and the nested configs beneath it, where it looks. A project that keeps none is handed the toolchain's default, the `node` profile, by path. Left to itself oxlint would walk up the tree for a config and apply whatever the folder the project sits in happens to hold, a temp folder or a workbench of clones among them. `baseline` hands the same default, so the file records what `check` reports.

A config handed by path resolves its `ignorePatterns` against its own directory, which is this package's. So the sweep leaves out what the default's patterns name instead, and a project with no config is spared the same folders as one whose config composes the profile.

### One run, and the log drawn from it

`check` runs the type-aware linter once, for its JSON report, and every reader of the pass reads that one report: the ratchet judges it rule by rule, the conventions checker's member runs take it instead of linting the project again, and a failing pass prints it. The type-aware run is the costliest process of a check — a JS plugin's rules run on one thread, and tsgolint builds the whole program — so a second run for a second format would double the pass for nothing it can say.

The report is printed on one more condition: the pass PASSED and the Test Conventions pass failed. The checker judges the `jterrazz(*)` diagnostics off this same report and prints only a count of them, so this pass is their one printer — each diagnostic once across the run, above the pass's own verdict, which stays its own. A report holding no diagnostic prints nothing there.

What a failing pass prints is still oxlint's own report, drawn from the JSON in the form oxlint picks for the environment: one line per diagnostic under an AI agent, GitHub workflow commands on a GitHub runner, and the framed report anywhere else, in colour where `CI` or `FORCE_COLOR` asks for it. The form is never guessed: the same binary, in the same environment, lints a one-line file, and its answer names the form. Whatever oxlint printed before its report — `No files found to lint`, or a config it could not parse and the report that never came — is printed as it came, then its standard error.

One thing the JSON report does not carry: which label a rule marks as its primary one. A framed diagnostic with several labels therefore names its first label's line and column in the frame's header, where oxlint would name the primary label's.

`fix` keeps its own two runs: the fixer, whose log is what it rewrote, then the JSON run the ratchet judges, made after it because the bytes have changed.

### The two refusals that are not diagnostics

A lint run can be green about nothing, and neither way shows up as a diagnostic. Both are the pass refusing, both are written into its own log, and both fail it — after them the verdict is on what the linter RAN, not on what it managed to exit with.

| Rule                     | Refuses                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `oxlint-config-unparsed` | a config oxlint could not parse, so it linted nothing      |
| `oxlint-config-commonjs` | a CommonJS config, which oxlint drops whole and in silence |

The first is usually a `jsPlugins` naming a module that is not there. oxlint prints `Failed to parse oxlint configuration file` above the pass's own line, and this names the refusal in the toolchain's vocabulary rather than leaving a reader with a tool's text.

The second is the silent one: a `.cjs` config, or a `.js` config in a package that is not `"type": "module"`. oxlint prints NOTHING and exits 0, so the run reads as green having enforced no rule the config named. Everything this package ships is ESM and so is every oxlint JS plugin the estate writes — a CommonJS config cannot load either.

### The fixers fix mode refuses

A fixer that changes MEANING is never applied unattended, so the oxlint run of fix mode turns off each rule marked `unsafe` in the manifest — the rewrite does not land, the diagnostic stays — `fix` and `check` report it alike — and a human answers it. The list, and what each rewrite does, is [Lint presets](07-lint-presets.md).

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

### A nested config fixes its own subtree

The fixer runs once per config scope. A wrapper is handed to oxlint with `-c`, and `-c` turns NESTED config discovery off for that run — so a project whose root config has a `sub/oxlint.config.*` beneath it gets one wrapped run for the files that config governs, and one for the rest. Each file is rewritten by the config `check` lints it by: the closest one above it.

It is one run per scope, not one config with the subtree folded in as an override, because oxlint's nested config REPLACES the root's rules in its subtree rather than extending them. An override can only add to what the root arms; it cannot take back a root rule the subtree never names.

A project with no config of its own is one scope. `check` hands the default with `-c` as well, so neither run reads a nested config there.

### A warning is a diagnostic

oxlint leaves its exit code at 0 for a warn-severity diagnostic, and a pass that passed prints no log — so `check` was silent on a tree `fix` failed, and the ratchet an adoption reaches for could not be reached through `check` at all. The check run passes `--deny-warnings`: every diagnostic the linter reports is printed and judged, whatever severity armed it.

The rulebook this package ships has no warn tier — a rule is on at `error` or off with a recorded reason — but a JS plugin composed beside it may have one, and `@jterrazz/test` does: a rule its catalogue marks `severity: 'warn'` — `no-redundant-root`, for one — ships at `warn` on purpose. A heuristic nobody is shown is a heuristic nobody answers.

### The two rewriters run in order

Every pass of `check` runs in parallel, and `fix` keeps that — except for the two passes that WRITE. `oxlint --fix` and `oxfmt` rewrite the same files, so in parallel whichever finishes second lands its own copy over the other's work, and the `check` that follows fails on what the fix had just settled. In fix mode they run one after the other, the linter first; every read-only pass still runs beside them.

## The Oxfmt pass

The formatter is handed the same sweep, whole rather than cut to the shapes a linter parses, and it skips a file it has no parser for. A project with no formatter config of its own — `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts` or `.mts` — is handed the preset by path, for the linter's reason, and the sweep leaves out what the preset's ignores name. So it judges neither the ground a test stands on nor a path git ignores, and that holds whether or not the project carries an `oxfmt.config.ts` whose ignores would say so. `fix` writes through the same list: it formats a new file before `git add`, and never reformats the ground or an ignored path. The preset's own ignores — `public/`, `assets/` and the rest — still apply on top.

## The ratchet

A project adopting a stricter rulebook has two honest options: burn every diagnostic down before the first green run, or record where it stands and refuse to go backwards. `jterrazz.baseline.json` is the second — one tracked file at the project root for the whole family, one section per package, `{ "typescript": { "<rule>": <count> }, "test": { … } }` — and the oxlint pass is judged by its `typescript` section rather than by oxlint's exit code. Without that section every diagnostic this package owns fails the pass — and the pass still names the rule it belongs to and the gesture that records it, so a project meets the ratchet on its first red run rather than after reading this page.

The section is EXACT: an entry states where the project stands, never a ceiling. Four things fail a run that has one, all under `baseline-ratchet`:

- a rule whose count **exceeds** its entry — the debt grew;
- a rule with diagnostics and **no entry** — a rule nobody recorded owing;
- a rule whose count is **below** its entry — the debt fell, so the entry is re-recorded;
- an entry whose count is now **zero** — the ratchet moved, so the entry goes.

The two falls are what make the section shrink. Without them a baseline records a debt that was paid a year ago and nothing ever says so, and the slack a fallen entry leaves lets new debt grow back into it unseen.

A run the section holds says so once, whole, and never finding by finding. The Oxlint pass prints one line for it, the shape `@jterrazz/test`'s checker gives its own section:

```text
jterrazz.baseline.json › typescript: 2 held across 2 rules
```

The count is every finding the section holds today — the linter's and the Names pass's alike — and the rules are the entries still carrying one; the section being exact, both are what the file records, and what the drift report prints. A section holding no entry reads `jterrazz.baseline.json › typescript: nothing held`, and so does a project keeping no `typescript` section, or no file at all — the one phrase `@jterrazz/test` prints for a project keeping no `test` section. The line prints only on `check`, and only when both of the section's judges hold; a broken side prints its evidence in its own pass instead, and the line stays away. So it does when the Names pass dies before it reports: a side nobody could read holds nothing the line may claim, and that pass prints why.

### One owner per entry

The ratchet splits by owner, and each package's command writes its own section of the one file. The `typescript` section holds oxlint's own rules, the Names (tree) pass's `names/*` entries ([its section](#the-names-tree-pass)) and the Comments (density) pass's `comments/comment-lines-held-by-the-baseline` ([its section](#the-comments-density-pass)). Every `jterrazz(*)` rule and every conventions-checker finding is the `test` section's, in the same shape, which `@jterrazz/test` writes and judges. `typescript baseline` rewrites its own section and leaves every other byte of the file as it was.

One oxlint run carries both packages' rules, because a consumer composes `@jterrazz/test`'s `testing` fragment into its config. One filter on the plugin name keeps any finding from being counted twice: a diagnostic whose code is `jterrazz(<rule>)` is set aside before this package counts, and the oxlint pass is green when those are all the linter reported. An entry under `jterrazz/` or `jterrazz-check/` in the `typescript` section is refused as misplaced, naming `jterrazz.baseline.json › test` — a finding lives in one section and answers to one judge.

The judge is told oxlint's exit code, so the split never forgives a failure no diagnostic carries: a linter that exits non-zero with an empty report failed on something else (a config it could not load), and the pass stays red. Severity is never read — a finding a release ships at `warn` is exactly the debt a ratchet exists to hold down.

`fix` is judged by the same section as `check`, on the diagnostics that SURVIVED its rewrite — so the pair reads the same verdict on the same tree. Before it judges, `fix` re-records what FELL: an entry whose count is below it is lowered to that count, and one at zero is dropped, each named in its pass — `re-recorded jterrazz.baseline.json › typescript › <rule> <was> → <now>`, the linter's entries under the Oxlint pass, the `names/*` ones under the Names pass and `comments/comment-lines-held-by-the-baseline` under the Comments pass. It never raises an entry nor adds a key: debt that grew is written only by `typescript baseline`, by hand. Judging only `check` made `fix` print a raw failure on every project carrying a baseline, and `make fix && make check` read red then green. The pair reads the same tree where there is NO section either: both count the diagnostics, both print the same lines, and neither reads severity.

### Recording it

```bash
typescript baseline
```

A command of its own, because it neither checks nor repairs: it writes down where the project actually stands, debt that grew included. `fix --baseline` would bury that rewrite inside the gesture a developer runs twenty times a day; `fix` records only the falls, which can make the file shrink and never let it grow. The `typescript` section is written from the current counts of this package's rules, then the file is handed to the project's own oxfmt — it is tracked like any other file, so the formatter owns its shape. The `test` section is recorded by `@jterrazz/test`'s own command, never by this one, and a file this command cannot read as sections is refused rather than rewritten. So is a run whose Names (tree) or Comments (density) pass wrote no report: that side of the section is unknown, and writing it would erase that debt rather than record it — `typescript check` prints why the pass died.

One more refusal keeps the file honest, in the Oxlint pass: `baseline-unreadable` — a `jterrazz.baseline.json` that is not JSON, or that holds a top-level key whose value is not a section of counts.

This repository's `typescript` section holds two entries. `eslint/max-lines`: the size caps turned on in 11.0.0 found nine files past 300 lines in its own source, splitting each is a change of its own, and the entry holds the files still past the cap so no new one arrives. `comments/comment-lines-held-by-the-baseline` is the comment debt the comment guards found on the day they arrived, burned down file by file. Turning type-aware linting on had found seven diagnostics, and those were fixed rather than recorded. The toolchain is consumer #1 of the rulebook it ships, so its own tree carries only the debt a new rule found, and only until it is paid.

## The Publish (packaging) pass

Every mistake this pass refuses is invisible in the repository and fatal in the registry: an `exports` entry pointing at a file nobody built, a subpath left out of `files` so it resolves in development and 404s in a consumer, a type declaration a modern resolver cannot see.

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

A published build never carries test material, and `publish/no-test-code-in-production` refuses one that does. The pass builds the package as it builds — its own `tsdown.config.*`, else the `bundle` preset over the entries its `exports` map earns — and reads each chunk's module ids off a `generateBundle` hook.

Without a config of its own, that build IS `typescript bundle`'s: the same preset file, and the entries the same [entry-points.js](../lint/reading/entry-points.js) reads off the map. Each chunk is named as the build writes it — `.js` and `.cjs` under the preset, and `.mjs` for an ESM chunk of a config that sets no extension — so `files` is asked about the path the tarball holds.

That build leaves the disk alone as far as tsdown lets it: no chunk is written, and the config's `copy`, `exe` and `onSuccess` are switched off. A config's own `hooks` are the one thing an inline option cannot switch off, so a `build:done` hook that writes still writes.

A file `files` ships is judged on three counts:

- a module of the package's own compiled into it, when `materialAt` names it — a `*.fixtures.ts`, a test file, ground, the specs tree, a contract;
- an installed module compiled into it, when `testPackageOf` names its package — bundling `vitest` is never meant;
- a specifier it leaves external, when `testPackageOf` names it and the package declares it neither in `dependencies` nor in `peerDependencies` — a test tool ships its runtime on purpose.

What test material IS is `@jterrazz/test`'s alone: the two readers are the ones its `no-test-code-in-production` rule judges by, published on its `./oxlint` entry, and the pass loads them rather than keeping a copy. The finding states itself in four parts and sends its reader to the `no-test-code-in-production` row, where the definition lives.

The readers come from the install the package resolves, found by the walk [test-package.js](../lint/reading/test-package.js) keeps, and from nowhere else. The toolchain's own `@jterrazz/test` is never asked: it is the toolchain's dependency, not the package's, and it would judge a package by a definition the package never chose.

A package with a build that resolves none, or resolves one before 17.0.0 that publishes no reader, has nothing to judge. The pass says so in one line, `publish/no-test-code-in-production: nothing to judge`, with the reason and, for a workspace member, `in <member>` — and builds all the same, so a build that fails still fails the pass. An install whose `./oxlint` entry throws on import is named for that, with the first line of what it threw, rather than taken for one older than 17.0.0. A package with no build — no config of its own and no target under `dist/`, like this package — hears nothing: there is no build to judge, and none to fail.

A build that fails is a finding too. `publish/build-succeeds` names tsdown's first error in the same four parts, and the pass carries on to publint and attw, so one run still says everything else it knows.

## The Architecture (layer map) pass

oxlint's `no-restricted-imports` reads a path and a pattern; dependency-cruiser resolves the module graph, which is the only way to see a cycle running through three files or an edge hiding behind a barrel. Where a project declares a map — `.dependency-cruiser.cjs`, `.js` or `.mjs` at its root — this pass reads it, and where it does not the pass never runs: a project with no declared architecture is not in breach of one.

**The rule ids are the config's own `name`s.** This is the one gate of the toolchain whose vocabulary the consumer writes, and that is the point: a layer map is a project's own architecture, so its rules are named for it.

A cruise starts from `src/` wherever there is one, and from whichever of `apps/`, `packages/` and `lib/` exist otherwise — a map never has to restate the shape of the tree it is about.

`dependency-cruiser` declares a `typescript <7` peer, and this tree satisfies it: the ordinary `typescript` dependency here is the ^6 JavaScript compiler API that perfectionist already needs ([Architecture](01-architecture.md)). That is also why the TS7 Go compiler stays out of `node_modules` under the name `typescript`.

## The Astro (check + format) pass

`.astro` is the one file shape oxfmt does not parse, and `astro check` is the only checker that reads a template's frontmatter. So where a project depends on `astro`, the pass runs both: the project's own `astro check`, and `prettier` over every `.astro` file.

**`prettier` and `prettier-plugin-astro` are dependencies of THIS package**, with a config derived from the oxfmt values — 100 columns, 4 spaces, single quotes, trailing commas everywhere. Five Astro consumers declare prettier today, each with its own copy of those numbers; after this, none of them declares a formatter at all.

The plugin is handed to prettier as a resolved path rather than as a name in the config, because prettier resolves a plugin name from the working directory — and the working directory is the consumer's, which is precisely the project that no longer declares it.

Both halves run in `fix` too: prettier writes, `astro check` is read-only wherever it runs. The pass speaks on success in fix mode alone, because there it rewrote files the operator owns.

## The drift report

Not a pass: a report, printed at the end of every `check`. Four numbers, because the alternative is what the estate had — twenty-eight repositories each quietly a little further from the shared rulebook, and nobody able to say by how much without opening twenty-eight config files.

```text
 DRIFT  Deviations from the profile

  profile                              node
  rules off vs profile                 none
  suppressions                         2
  jterrazz.baseline.json › typescript  7
  jterrazz.baseline.json › test        3
  tool versions                        in range
```

A rule turned off, a suppression written, a baseline entry recorded and a tool left behind are the four ways a project drifts. Three of them are one line; the baseline is named by BOTH sections this toolchain family writes — `typescript` always, `test` only where the project keeps one — because a count with no section beside it says nothing about which debt it is. A section absent, or holding no entry, reads `nothing held` — the Oxlint pass's words for the same state, so one state has one word. A file the Oxlint pass refuses as `baseline-unreadable` reads `unreadable`: it was never read, so it holds no count the row may claim, not even none. `typescript check --json` prints the same reading for a machine — the block under the `DRIFT` header becomes one JSON object, every pass above it still prints for a human — which is how a fleet-wide sweep collects the table. Its `baseline` and `testBaseline` are the section's total, `null` for a section the file does not keep, or `"unreadable"`: where a person reads `nothing held` for both, the machine keeps an absent section (`null`) apart from an emptied one (`0`), because a sweep counting who adopted the ratchet needs the difference.

**The profile is read off the consumer's config, and a config that names none is NOT measured.** A project extending no profile of this package is not drifting from one, it never joined it, and reporting two hundred rules as "off" would say nothing about anything. The name comes from the config's own `import`, which is the only evidence there is: oxlint's config schema is closed, so a compiled profile cannot carry its own name through to `--print-config`.

A project with no oxlint config of its own is measured against the default `check` hands its linter, the `node` profile: its profile line reads `node (the default — no config of its own)`, and `--json` names it `node` with `config: "default"` — where a project whose own config extends `node` reads `config: "own"`, so a fleet sweep tells the two apart. The default is the profile itself, so no rule is off it and nothing can be unreasoned; the other three numbers are the project's as for any other.

The versions line reports only what deviates. The full table is `typescript doctor`'s, and printing it on every run would put a number that changes with every dependency bump in front of a reader looking for what changed in their own tree.

### The one thing it refuses

<!-- GENERATED:findings drift -->

| Rule                               | Requirement                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `drift/off-rule-states-its-reason` | A rule the profile has on, turned off by the project, carries its // reason:. |

<!-- /GENERATED:findings drift -->

A project may know things the profile does not, so turning a rule off is allowed. Doing it silently is not: the reason is what the next reader — or the next bump — needs, and a config line is where it belongs. Everything else in the report only ever reports.

## The Suppressions (directives) pass

Every place the project told a checker to look away. A suppression is a decision, and a decision the next reader cannot re-derive is a defect waiting to be re-introduced, so three rules hold the whole surface.

<!-- GENERATED:findings suppressions -->

| Rule                                      | Requirement                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `suppressions/spelled-for-this-toolchain` | A suppression is spelled for a checker this toolchain runs: oxlint-disable, @ts-expect-error. |
| `suppressions/states-its-reason`          | Every suppression states the reason it exists.                                                |
| `suppressions/no-dead-suppression`        | A directive names only a rule the resolved config has on.                                     |

<!-- /GENERATED:findings suppressions -->

A directive is read only where a checker reads one: at the OPENING of a comment. Prose about a suppression, and a string carrying its spelling — the gate's own source is made of both — is not a suppression, and neither oxlint nor tsc would treat it as one.

`suppressions/no-dead-suppression` asks `oxlint --print-config` for the project's resolved rules, and that map holds what the config DECIDED rather than oxlint's whole catalogue: a rule missing from it is a rule this project does not run, which is the only question being asked. The map is resolved PER FILE, the way oxlint resolves it: the top-level `rules`, then every `overrides` entry whose globs match that path, in the order they were written, the last one winning. A rule armed only in an override — a test-file rule, a layer's `no-restricted-imports` — is therefore live inside the files that override names and dead outside them, and a rule one override turns off and a later one arms again is live wherever the later one reaches. A JS plugin's rules never appear there at all, so a directive naming one — `jterrazz/cli-runs-the-product-binary`, say — is left alone rather than called dead on evidence the gate does not have. That holds for the whole namespace, `allow` entries and all: a config that turns three of the plugin's rules off puts those three names in the map and still none of the live ones, so a namespace the printed `plugins` list does not carry answers nothing.

A directive naming a plugin rule that no longer exists is still refused, one pass earlier: it suppresses nothing, and every profile ships `reportUnusedDisableDirectives` at `error`, so the Oxlint pass reports the directive itself as unused.

### What `typescript fix` rewrites

Two spellings, both mechanical. An `eslint-disable*` becomes `oxlint-disable*` when every rule it names is one this project runs — a name that means nothing here is a directive whose intent only its author knows. A `@ts-ignore` becomes `@ts-expect-error`, which is the same suppression plus a failure when the error it was covering is gone.

It never invents a reason, and it never deletes a directive: both are the author's judgement, and a rewrite that guessed either would be worse than the report.

## The Markdown (prose) pass

Every `*.md` git does not ignore, outside the ground a test stands on — a `fixtures/`, `expected/`, `seeds/` or `requests/` folder wherever it sits, another project's tree — is read for two things: whether its coordinates resolve, and whether its blocks breathe.

<!-- GENERATED:findings markdown -->

| Rule                                    | Requirement                                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `markdown/link-resolves`                | Every relative link of a page resolves on disk.                        |
| `markdown/path-resolves`                | Every backticked repository path of a page names something on disk.    |
| `markdown/chapter-reference-resolves`   | Every chapter a skill names is one its package ships.                  |
| `markdown/prose-block-is-short`         | A paragraph or a list item runs twelve lines at most.                  |
| `markdown/fenced-run-is-short`          | A fenced block breathes within fifteen lines.                          |
| `markdown/long-section-has-subheadings` | A section over thirty prose lines is broken by a subheading or a list. |

<!-- /GENERATED:findings markdown -->

A skill is read from the install, where nothing can correct it, so one more rule reads a page under `skills/` alone: `markdown/chapter-reference-resolves` refuses a `docs/NN-name.md` it names that its package does not ship. The chapter is resolved beside the skill's own `skills/` folder, the package root it is published from.

The three numbers are the readability floor of the shared doctrine, not the craft it asks for: the gap between them is a reader's pass, not a red gate. They are named constants at the top of the gate, and no page keeps a second copy of them.

The backtick rule reads a closed roster of opening segments — `apps/`, `bin/`, `lib/`, `lint/`, `packages/`, `presets/`, `specs/`, `tests/` — because without one every `a/b` in a sentence would be read as a coordinate. `docs/` and `src/` are deliberately off it: every repository has both, so a page teaching a convention writes `src/index.ts` about the READER's tree, not about its own. A relative LINK into either is still judged, because that one names a real target.

A path of somebody ELSE's tree — a library's chapter showing where the thing it ships lands in a consumer — is shown in a code fence, never in backticked prose. The rule reads a backticked coordinate as this repository's own and is right to: the alternative is an allow-list, and the first path that stops existing is the one nobody notices. A fenced block is exempt, so the example that teaches a consumer stays exactly where a reader wants it.

## The Names (tree) pass

What a project calls its own parts, swept under the roots where a project keeps what it wrote: `apps/`, `bin/`, `lib/`, `lint/`, `packages/`, `specs/`, `src/`, `tests/`. Each root's OWN name is the toolchain's vocabulary rather than the project's choice, so it is never judged — `lib/` sits on this list and on the grab-bag roster at once, and only what a project put inside it is the project's to name. A directory below an `app/` router root is a Next.js route segment — a URL the product serves, not a name the tree chose — and is not judged either; the files inside it still are.

<!-- GENERATED:findings names -->

| Rule                               | Requirement                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `names/no-grab-bag-name`           | A directory or file is named for the subject it holds, never a grab-bag word.        |
| `names/no-language-construct-name` | A directory or file is named for its subject, never for a construct of the language. |
| `names/no-abbreviated-word`        | Every word of a name is spelled whole.                                               |

<!-- /GENERATED:findings names -->

All three rosters are closed and all live in the gate, in one executable copy. Grab-bag: `base`, `common`, `helpers`, `lib`, `misc`, `stuff`, `tools`, `utils` — a leading `_` exempts one, because it marks a row rather than a subject. Construct: `constants`, `helper`, `interfaces`, `type`, `types`, `util`, and the `.types.ts` suffix — a word the grab-bag already refuses is reported once, under that roster, and the `_` marker does not excuse a construct. Shortcut: `auth`, `cfg`, `impl`, `infra`, `k8s`, `pkg`, `repo`, `repos`, `svc`, `tmp` — and the `_` marker does NOT excuse one, since it states a position, not whether the name is whole.

A construct is judged on the WHOLE name: `type-registry.ts` names a subject and passes, `types.ts` names a part of the language and fails. Two words stay off the rosters though they sound generic, because each names a role a reader recognises at once: `setup` is what a runner loads before a test (`vitest.setup.ts`, a `setupFiles` entry), and `core` is the part of a layered tree every other layer depends on. `index.ts` is a barrel — a structural role, not a category — and no roster holds it. The ground a spec stands on is never swept at all, so a fixture may be called anything its scenario needs.

### The repository spine

The root's own folders are the same in every repository: `src/` the product's code, `lint/` the lint rules a package ships, `specs/` the specifications, `docs/` the manual, `skills/` one short page per skill — and `apps/` or `packages/` where a workspace keeps its members, each a spine of its own. What the tree calls a root is therefore judged too. The table holds the whole `tree` family: the spine's rules, and those of [the lint tree](#the-lint-tree) and [an empty directory](#an-empty-directory) below. The family names what a rule judges; the prefix names the pass that prints it, and the Names pass prints both families, so a `tree` rule reads `names/…` like a `names` one.

<!-- GENERATED:findings tree -->

| Rule                                    | Requirement                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `names/no-undeclared-root-folder`       | Every root folder is on the spine, imposed by a tool, or declared with its reason.                    |
| `names/declared-root-states-its-reason` | A root declared in typescript.roots states why the repository keeps it.                               |
| `names/declared-root-holds-files`       | A root declared in typescript.roots holds a file git does not ignore.                                 |
| `names/jterrazz-config-loads`           | The settings file jterrazz.config.ts loads, and its typescript section has the declared shape.        |
| `names/skill-holds-only-skill-md`       | A skill is one skills/<skill>/SKILL.md and nothing beside it.                                         |
| `names/repository-has-makefile`         | Every repository root carries a Makefile.                                                             |
| `names/makefile-answers-every-gesture`  | The Makefile writes a rule for each of the six gestures.                                              |
| `names/no-empty-directory`              | No directory of the working copy is empty.                                                            |
| `names/lint-root-holds-only-index`      | The root of lint/ holds its index and nothing else.                                                   |
| `names/lint-folder-is-known`            | Every folder of lint/ is one of catalogue, rulebook, rules, checks, ratchet, reading and self.        |
| `names/self-folder-is-known`            | Every folder of lint/self/ is one of catalogue, rulebook, rules, checks, ratchet, reading and corpus. |
| `names/rule-file-in-its-family-folder`  | A rule file sits under rules/<family>/, the family its catalogue row declares.                        |

<!-- /GENERATED:findings tree -->

A skill is hand-written and read from the install, so anything beside its page is a second copy of a chapter or a projection of something the package already owns. A dot-folder (`.github/`, `.vscode/`) is the tools', never the spine's, and is not judged.

`lint/` stands on the spine only where the package SHIPS it, and it ships it one of two ways. Directly: an entry of its `package.json`'s `files`, or a target of its `exports`, reaches into `lint/`. Or through its build: an entry of its `tsdown.config.*` compiles a `lint/` source, and the output it compiles to — `dist/<entry>`, or under the config's `outDir` — is published by an `exports`, `bin` or `main` target, or by a `files` entry no later `!` entry takes back. A package that ships its rules as `dist/oxlint.js`, built from an `index.ts` under `lint/`, is the case the second way exists for.

A `lint/` nothing publishes holds rules no consumer receives — `src/` under another name — and is refused as `names/no-undeclared-root-folder`. The build config is read as text, never run: an entry is named for its key, `oxlint: 'lint/index.ts'`, or for its file where it has none.

A workspace member is a spine of its own, judged the same way from its own folder: its first-level folders owe the spine, its `lint/` answers to its own `files`, `exports` and build, and it declares the roots it keeps beyond the spine in its own `jterrazz.config.ts`. The `Makefile` stays the repository root's.

#### The six gestures

Every repository answers the same six at its root, whatever the language under it: `make install`, `make build`, `make lint`, `make fix`, `make test` and `make check`. The flows speak only these, so a session that has never opened the repository still knows how to install, prove and repair it. What each recipe runs is the repository's, save how `fix` meets a failure; that the rule exists is the contract.

The contract is asked where a REPOSITORY is — a `.git` beside the project, as for [the Docs (layout) pass](#the-docs-layout-pass) — and an ignored `Makefile` counts for none, like every path a tree gate skips. A workspace member owes nothing: the repository's root answers for every member, and a member linted on its own is never asked.

A target counts when the `Makefile`'s own text writes a rule for it — `lint:`, `install build:`, `test::` — and an assignment (`LINT := …`) or a comment is no rule. A file the `Makefile` `include`s is not read, so the six stay written where a reader opens first.

`fix` runs every fixer the repository has, each whatever the one before it said, and fails at the end if any of them did. Make stops a recipe at its first failing line, so fixers written one per line leave the next unrun whenever one reports — a checker failing on debt it cannot settle would keep the formatter from the files it had just rewritten. The recipe runs them in one shell and carries the verdict to its end.

The order is the second half of the contract: `@jterrazz/test`'s checker first, `typescript fix` last. The checker's fixers write source — a `describe` wrapped, a ground file inlined — and the toolchain's formatter runs after them, so the last writer of every file is the one `check` judges its format by:

```make
fix:
	@status=0; \
	npx jterrazz-test-check --fix || status=1; \
	npx typescript fix || status=1; \
	exit $$status
```

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

The list is closed and short on purpose. `scripts/`, `docker/` or `migrations/` are conventions, not impositions: every tool that reads one takes its path as an argument, so the repository chose the folder and says why.

The second ground is that saying: the repository declares the root in its settings file, `jterrazz.config.ts`, under `typescript.roots`, each with its reason ([Developing](02-developing.md#5-state-a-setting-where-there-is-one)).

```ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

The file holds one section per package of the family, each package reading only its own, so a root declared anywhere else — a `jterrazz` key in `package.json` included — is not read. A file that does not load, or whose `typescript.roots` is not an object mapping each folder to its reason, is refused as `names/jterrazz-config-loads`, and the roots it meant to declare stand undeclared until it is fixed. The reason is not decoration: an entry without one is refused (`names/declared-root-states-its-reason`), and an entry whose folder holds no file git does not ignore is refused too (`names/declared-root-holds-files`), so the list shrinks as the tree does. A base package that composes others keeps its broader roots through this same declaration, never through an exemption in the gate.

### The lint tree

`lint/` has one tree in every repository that keeps one, whatever the package: what it ships at `index`, and a folder for each nature of what it judges with — `catalogue/`, `rulebook/`, `rules/`, `checks/`, `ratchet/`, `reading/`, `self/`, each holding what [Architecture](01-architecture.md#the-judging-layer) says it holds. A reader who knows one repository's `lint/` knows every one, so the pass holds each unit that keeps a `lint/` to it, a workspace member included. `names/lint-root-holds-only-index` refuses a file at its root not named `index` — `index.ts`, `index.js`, `index.d.ts` and their tests pass; `names/lint-folder-is-known` a folder outside the seven; `names/self-folder-is-known` a folder of `self/` outside the shipped six and `corpus/`, since `self/` files what only its repository is held to as the shipped tree files it; `names/rule-file-in-its-family-folder` a rule file filed at the root of `rules/`, or under a folder its catalogue row does not name.

The family is read off the unit's own catalogue: every file directly under `lint/catalogue/`, read as text and never run, where a row is any object literal stating an `id` or a `name` and a `family` — a JSON row and a TypeScript manifest row alike, the plugin prefix of an id left aside. A rule file is matched to its row by its name, its test with it. A unit with no catalogue, or a rule no row names, is held to the first two rules alone: a family is never guessed.

### An empty directory

The tree is judged on the disk as well as by its names. git tracks no directory, so an empty one exists only on the machine that holds it — a folder a fixer or a move emptied, a scaffold nobody filled — and it tells the next reader of that disk about a part of the tree that is not there. `names/no-empty-directory` refuses a directory holding no file at any depth that git does not ignore.

A directory holding only empty directories is empty, and is named once, at its top. The walk never enters `.git/`, a directory holding a `.git` of its own, or a folder no gate reads — `node_modules/`, `.artifacts/`, `dist/` and the rest the sweep leaves out — and a directory git ignores, or an `--ignore-pattern` names, is left alone. The finding states itself in four parts, `found: … · why: … · fix: … · read: …`.

`typescript fix` deletes each one before it judges the tree, printing a `removed` line per directory, and renames nothing else. It deletes bottom-up, one empty directory at a time, so a file that landed in one since the walk stops the deletion rather than going with it. CI never meets the rule: a fresh clone holds no empty directory.

### What the ratchet records

Every rule is printed and recorded as `names/<rule>`, and carries the code `names(<rule>)`: `typescript baseline` writes the pass's counts into the `typescript` section of `jterrazz.baseline.json` beside the linter's, and where the section holds a `names/*` entry this pass is judged by it, exactly, with the four refusals of [the ratchet](#the-ratchet) — and `typescript fix` re-records the entries that fell, as it does the linter's. A project adopting the construct roster records its existing sites once and renames them by domain, one entry at a time.

## The Comments (density) pass

The default is no comment: the code speaks through its names, and a name that needs a comment is renamed instead. So the number of comment lines a project holds is held exactly, like a debt — a new one is a decision someone records, never a drift nobody saw.

**What is measured.** Every source file the Oxlint pass lints — a `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.astro`, `.vue` or `.svelte` that git does not ignore, tests included — outside the ground a test stands on and every `--ignore-pattern`. A file whose first five lines carry `@generated` is a tool's output, not the project's prose, and is skipped; so is every Markdown page, which is documentation, not a comment.

**What a comment line is.** A physical line that any comment covers — a `//` line, a trailing `//` after code, and every line a `/* … */` block spans, its opening and closing lines included — read by the same reader the Suppressions pass reads directives with, so a `//` inside a string or a template is never one. A line whose only comment is a directive (`oxlint-disable*`, `eslint-disable*`, `@ts-expect-error`, `@ts-ignore`, `biome-ignore`) is not counted: a directive is the Suppressions pass's, and the reason it carries is required there. Nor is a test's `// Given - `, `// When - ` or `// Then - ` marker: `@jterrazz/test` requires it of every test, so it is structure, and adding a test never moves the count.

<!-- GENERATED:findings comments -->

| Rule                                                      | Requirement                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `jterrazz-typescript/comment-no-longer-than-its-function` | A comment run above a function is no longer than the function it documents.           |
| `comments/comment-lines-held-by-the-baseline`             | The count of comment lines a project holds is exactly the count its baseline records. |

<!-- /GENERATED:findings comments -->

The count is recorded as `comments/comment-lines-held-by-the-baseline` in the `typescript` section of `jterrazz.baseline.json`, and judged with the four refusals of [the ratchet](#the-ratchet): a count above the entry, a count and no entry, a count below it, an entry left at zero. `typescript fix` lowers the entry to a count that fell, and drops it at zero; only `typescript baseline` raises it, by hand, for a comment that states what the code cannot. The finding states itself in four parts, `found: … · why: … · fix: … · read: …`, and its `found` gives the density — the lines, and their share of the measured source.

## The Secrets (credentials) pass

No file the project would commit carries a live-looking credential. Two engines answer that one question, over the same files — every one git does not ignore, the ground a test stands on and `--ignore-pattern` left out, as for every tree gate. Where `gitleaks` is on PATH it runs as `gitleaks dir . --no-banner --redact` over a copy of exactly those files, so a finding names the file and never reprints the secret; where it is not, ten patterns over their text answer well enough to stop the leak that actually happens — a token pasted into a note and committed with it.

Which engine runs is decided inside the gate rather than in `check.sh`, because the gate applies either way. Bash decides whether a pass applies; this one always does, and what changes is only who answers.

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

## Pitfalls

- **A nested `oxlint.config.*` is loaded only on the path of a file oxlint is handed.** `check` hands it the sweep, which never holds the ground a test stands on, so a config committed under `fixtures/` is never read, armed or broken. Handed a directory instead — the fallback when the sweep could not answer — oxlint discovers every config beneath it and loads them all before it lints anything, and one that cannot load fails the run.
- **An ignore without a reason is the expected form of nothing.** Every entry in the project's `knip.json` tells the gate to overlook something, and the next reader has to re-derive why. The file is read as JSONC, so the reason goes beside the entry as a `//` comment — that is the form this toolchain expects, and the shape of the file is [Lint presets](07-lint-presets.md)'s.
- **An export used in its own file is not dead.** The base preset sets `ignoreExportsUsedInFile: true`, so the `cleanup-passed-to-after-all` idiom's same-file `cleanup` and a capsule's flags read back by its sibling test never need a project-local `knip.json` line to stay unreported.
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.
- **Knip runs uncached, on purpose.** Its `--cache` would be the obvious speed-up and it can lie: a cached glob is validated against the mtimes of the directories that held a match, so a file added to a directory that held none is invisible, and the cached run passes a project the uncached run fails. Every other cache in the toolchain — tsc's buildinfo — is keyed on content and cannot.

## Related

- [Lint presets](07-lint-presets.md) — oxlint presets, compose, architecture.
