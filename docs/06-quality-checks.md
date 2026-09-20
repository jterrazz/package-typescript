# Quality checks

`typescript check` runs every quality gate in parallel; `typescript fix` auto-repairs what it can.

Every pass that RAN prints the same block, in one fixed order: a `RUN` header carrying its name, whatever it has to say, and one verdict line. A pass that did not apply — no Astro in the project, no declared layer map — prints nothing at all, because it answered no question.

What sits between the header and the verdict is the one variable. A failing pass prints its whole captured log; a passing one stays silent, unless it WROTE something — `fix` changed a file the operator owns, and silence would hide that. A tool's success chatter never reaches the stream, so a green run is byte-identical on every platform.

The order is the table below, top to bottom, and the drift report closes the run.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package gate once per member, and a single-package project is the same run it always was.

## The passes

`typescript check` runs up to fifteen passes. Three spawn a tool on every invocation, knip and four tree gates run on every `check`, and the other seven are opt-in — they appear only when the project qualifies.

| Pass                              | Tool                        | When it runs                                                      |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| TypeScript Check                  | tsc (TypeScript 7, Go)      | always                                                            |
| Oxlint Check                      | oxlint (`--type-aware`)     | always (judged by `oxlint.baseline.json` where there is one)      |
| Oxfmt Check                       | oxfmt (Rust)                | always                                                            |
| Gitignore (artefacts)             | the artefact gate           | check: project or ancestor `.gitignore`; fix: project's own       |
| Knip (unused code)                | knip (Node)                 | always (check only — it is not run in fix)                        |
| Test Conventions (@jterrazz/test) | conventions checker         | per `specs/` root; per member resolving `@jterrazz/test` ≥ 15.3.0 |
| Docs (layout)                     | the manual gate             | check: at a repository root (a `.git` beside the project)         |
| Docs (sync)                       | `typescript docs --check`   | per package that has committed docs (`docs/reference/`)           |
| Publish (packaging)               | publint + attw              | per package the registry would accept (not `private`)             |
| Architecture (layer map)          | dependency-cruiser          | check: a `.dependency-cruiser.*` at the project root              |
| Astro (check + format)            | astro check + prettier      | per project that depends on `astro` (check and fix)               |
| Suppressions (directives)         | the suppression gate        | always (check and fix — `--fix` settles two spellings)            |
| Markdown (prose)                  | the prose gate              | always (check only — a paragraph is not machine-split)            |
| Names (tree)                      | the naming gate             | always (check only — a rename is a move, not a rewrite)           |
| Secrets (credentials)             | gitleaks, else the patterns | always (check only — a leak is rotated, not reformatted)          |

`typescript fix` runs tsc, oxlint (`--fix`), oxfmt, the artefact gate and the suppression gate in parallel — knip, the conventions checker, the two Docs passes and the remaining tree gates are check-only (they are read-only gates, not fixers).

### In a workspace

When the `package.json` at the cwd declares `workspaces`, the per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/docs/reference` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed.

The Docs (layout) pass measures from neither: its unit is the repository, and the section below says why.

The other four passes are root-only, and that is not an omission. tsc, oxlint and oxfmt measure from their **config file**, not from a package, and each already walks the whole tree from the cwd. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

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

The member pass is behind the release that answers it. `--member` arrives in `@jterrazz/test` 15.3.0; where a member resolves an older one the pass names that member and the version it found, and the tree passes run alone, rather than leaving a reader to believe every member was asked. The tree pass asks for no floor — every release answers it.

## The Docs (layout) pass

Every repository carries the same manual — a map at `docs/README.md`, a fixed spine, and its own chapters numbered contiguously after it — and this pass refuses a tree that breaks it.

Its unit is the **repository**, not the package: a manual answers for a whole tree, and only its root carries the `AGENTS.md` that routes into it. So the pass asks its question exactly where a repository is — a `.git` beside the project, a file in a worktree and a directory in a clone — and nowhere else. A fixture directory is not a repository, and neither is a workspace member linted on its own.

Nothing else gates it. A repository with **no** `docs/` at all is not exempt; it is the case the rule exists for, and it fails on `docs-absent`.

The spine itself is language-agnostic doctrine, and it is [`jterrazz-studio`'s](https://github.com/jterrazz/jterrazz-studio/blob/main/docs/08-repo-structure.md): the four fixed names, the three subfolders, the water line between a repository's manual and its brand's wiki. What this chapter owns is the rule ids and what each one refuses. The sentence a rule prints is not here — it lives in the engine, so a page and a gate cannot drift.

| Rule                       | Refuses                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `docs-absent`              | no `docs/` at the repository root                                          |
| `docs-map-missing`         | a `docs/` with no `README.md`                                              |
| `docs-map-drift`           | a map and a chapter list that are not bijective                            |
| `docs-map-foreign-link`    | a map link to anything but a chapter, `decisions/` or `reference/`         |
| `docs-chapter-name`        | a chapter that is not `NN-kebab.md`                                        |
| `docs-chapter-numbering`   | numbers that skip (04 aside), or one number on two files                   |
| `docs-spine-name`          | a chapter sitting on a reserved number under another name                  |
| `docs-spine-missing`       | an absent `01-architecture.md`, `02-developing.md` or `03-testing.md`      |
| `docs-operating-missing`   | an absent `04-operating.md` when the presence test below fires             |
| `docs-journal-chapter`     | a chapter named for the state of a piece of work, not for a subject        |
| `docs-foreign-folder`      | a subfolder of `docs/` other than `decisions/`, `reference/`, `_assets/`   |
| `docs-loose-file`          | a file directly under `docs/` that is neither the map nor a chapter        |
| `docs-decision-name`       | a record in `decisions/` that is not `NNN-kebab.md`                        |
| `docs-decision-heading`    | a record opening on anything but `# ADR-NNN: Title`, or on another number  |
| `docs-decision-status`     | a `**Status:**` that is absent or outside the closed vocabulary            |
| `docs-decision-sequence`   | a `decisions/` folder whose numbers skip, or start above 001               |
| `docs-decision-number`     | one ADR number claimed by two records                                      |
| `docs-decision-index`      | a hand-written `decisions/README.md` — an index is a copy                  |
| `docs-template-missing`    | a `decisions/` with no `_template.md` beside the records                   |
| `docs-reference-unstamped` | a page under `reference/` carrying no generation marker on its first line  |
| `docs-agents-route`        | a repository whose root `AGENTS.md` is absent or does not route to the map |
| `docs-cross-repo-link`     | a link from `docs/` reaching into another repository's tree                |

Three things about the roster are decisions, not details:

- **The `04-operating.md` presence test is derived, and there is no configuration key.** It fires on a `Dockerfile` (or `Dockerfile.*`), on an `.infrastructure/` directory — either at the repository root or at a workspace member's root, since a monorepo deploys from a member as readily as from its root — or on a root `package.json` that is not `"private": true`. The publishable clause reads the root manifest alone: a private root holding a publishable member is a question for its owner, not a verdict for a gate.
- **The pass only ever REQUIRES a chapter; it never forbids one.** A repository that releases by a tagged workflow and ships neither an image nor a package writes its `04-operating.md` and hears nothing about it. Machine-holding the other half would mean parsing `.github/workflows/**`, which is another repository's shape.
- **The journal-word roster is closed, and it is in the code.** `exploration`, `review`, `notes`, `proposal`, `draft`, `wip`, `old`, `legacy`, `misc`, `todo` — matched as whole words of a chapter's name. No page keeps a second copy of it; the one that matters is executable.

### Outside an npm project

```bash
npx --yes --package=@jterrazz/typescript -- typescript docs-layout .
```

The `--package` flag and the bin name are both spelled out on purpose: the shorter `npx @jterrazz/typescript docs-layout .` lets npm infer the command from the package name, and that inferred name — `typescript` — collides with the `typescript` package this one depends on, which crashes npm's resolution of the ephemeral install tree on some npm/Node combinations even though the short form works on others.

The same gate, on any tree: a Go, Rust or Ansible repository wires that line into its own `make lint`. It needs nothing installed, takes the repository root as its argument, and prints one line per violation as `<rule>  <path>  <message>`. Unlike the pass it never asks whether the tree is a repository — the operator already said so by running it. It is `docs-layout`, and not `docs check`, because `typescript docs --check` already exists and asks a different question ([Docs pipeline](08-docs-pipeline.md)).

### Reusing the rules

The engine is a pure function, exported at `@jterrazz/typescript/docs`:

```ts
import { auditDocs } from '@jterrazz/typescript/docs';

const violations = auditDocs(tree); // -> [{ rule, path, message }, …]
```

`tree` is a plain description of one repository — the paths under `docs/`, the opening lines of each page, each page's link targets, the root `AGENTS.md`, and the three presence facts. No filesystem, no transport: a sweep across clones nothing has been installed into judges by the same copy of the rules as the gate. `HEAD_LINES` says how far down a page a rule reads, so a `**Status:**` below it is a status the manual does not declare.

## The Oxlint pass

`--type-aware` is passed explicitly and unconditionally. The rules it unlocks are the ones no syntactic linter can express, and a flag that is only sometimes passed is a rule set that is only sometimes enforced. Those rules run in `tsgolint`, a separate binary oxlint looks up on PATH; `oxlint-tsgolint` is a dependency of this package, and `check.sh` puts the directory holding it in front of PATH for its own children, so a consumer never installs or configures anything.

### The two refusals that are not diagnostics

A lint run can be green about nothing, and neither way shows up as a diagnostic. Both are the pass refusing, both are written into its own log, and both fail it — after them the verdict is on what the linter RAN, not on what it managed to exit with.

| Rule                     | Refuses                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `oxlint-config-unparsed` | a config oxlint could not parse, so it linted nothing      |
| `oxlint-config-commonjs` | a CommonJS config, which oxlint drops whole and in silence |

The first is usually a `jsPlugins` naming a module that is not there. oxlint prints `Failed to parse oxlint configuration file` above the pass's own line, and this names the refusal in the toolchain's vocabulary rather than leaving a reader with a tool's text.

The second is the silent one: a `.cjs` config, or a `.js` config in a package that is not `"type": "module"`. oxlint prints NOTHING and exits 0, so the run reads as green having enforced no rule the config named. Everything this package ships is ESM and so is every oxlint JS plugin the estate writes — a CommonJS config cannot load either.

### The fixers fix mode refuses

A fixer that changes MEANING is never applied unattended, so the oxlint run of fix mode allows each rule marked `unsafe` in the manifest — the rewrite does not land, the diagnostic stays — `fix` and `check` report it alike — and a human answers it. The list, and what each rewrite does, is [Lint presets](07-lint-presets.md).

The allowance is a wrapper config the pass writes at the project root and deletes after the run. It goes there and nowhere else, because oxlint resolves `ignorePatterns` against the directory its config sits in — and the run it configures IGNORES it, so no diagnostic ever names a path the operator cannot open and no tree can ever clear.

That wrapper also stops the run reporting UNUSED DIRECTIVES. Every profile ships `reportUnusedDisableDirectives`, and a run that has just turned twelve rules off cannot judge a directive naming one of them — the rule is off for that run alone, and the directive would be called dead on evidence the wrapper itself created. An unused directive is reported by the check-shaped run made after the fixer, where the consumer's own rules are armed again, and by `check`.

### A warning is a diagnostic

oxlint leaves its exit code at 0 for a warn-severity diagnostic, and a pass that passed prints no log — so `check` was silent on a tree `fix` failed, and the ratchet an adoption reaches for could not be reached through `check` at all. The check run passes `--deny-warnings`: every diagnostic the linter reports is printed and judged, whatever severity armed it.

The rulebook this package ships has no warn tier — a rule is on at `error` or off with a recorded reason — but a JS plugin composed beside it may have one, and `@jterrazz/test` does: its `<family><n>w-…` redundancy heuristics ship at `warn` on purpose. A heuristic nobody is shown is a heuristic nobody answers.

### The two rewriters run in order

Every pass of `check` runs in parallel, and `fix` keeps that — except for the two passes that WRITE. `oxlint --fix` and `oxfmt` rewrite the same files, so in parallel whichever finishes second lands its own copy over the other's work, and the `check` that follows fails on what the fix had just settled. In fix mode they run one after the other, the linter first; every read-only pass still runs beside them.

## The ratchet

A project adopting a stricter rulebook has two honest options: burn every diagnostic down before the first green run, or record where it stands and refuse to go backwards. `oxlint.baseline.json` is the second — a tracked `{ "<rule>": <count> }` at the project root, and the oxlint pass is judged by it rather than by oxlint's exit code. Without the file a single diagnostic fails the pass, exactly as before — and the pass still names the rule it belongs to and the gesture that records it, so a project meets the ratchet on its first red run rather than after reading this page.

Three things fail a run that has one, all under `baseline-ratchet`:

- a rule whose count **exceeds** its entry — the debt grew;
- a rule with diagnostics and **no** entry — debt nobody recorded owing;
- an entry whose count is now **zero** — the ratchet moved, so the entry goes.

The third is what makes the file shrink. Without it a baseline records a debt that was paid a year ago and nothing ever says so.

The file records two reporters, not one. `@jterrazz/test`'s conventions checker judges the same tree from the other side — how a spec is written rather than what the code does — and a project adopting a stricter version of THAT rulebook needs the same ratchet for the same reason. Its `--format json` findings are merged before the counting, under the namespace its own codes carry: `jterrazz-check(d4)` is recorded as `jterrazz-check/d4`, beside `eslint/no-debugger`, in one flat file. Severity is never read — a finding a release ships at `warn` is exactly the debt a ratchet exists to hold down — and the three refusals above are the same three, whichever reporter names the id.

One run answers for the checker's side: `jterrazz-test-check --format json` at the project root, made by `baseline` when it records and by `check` when it judges, with no path and no `--member` — so the contract the ratchet rests on is that a path-less run reports what the pass's own runs report, every `specs/` root and every member. It is made only where the installed `@jterrazz/test` answers the flag (15.3.0). Below it no `jterrazz-check` count exists, and the recorded `jterrazz-check/*` entries are set ASIDE rather than read as debts that reached zero: nothing measured them, and the third refusal would otherwise ask a project to delete the entries its next install needs.

A baseline recorded before this second reporter existed holds no `jterrazz-check/*` entry at all, and the run that first counts one in would otherwise refuse every finding by rule — debt the project never owed, on a tree that has not moved. It refuses once instead, by name: `<file> records one reporter — run 'typescript baseline' once to enrol @jterrazz/test's <n> finding(s)`. One `typescript baseline` afterwards is the whole migration; the per-rule refusals return exactly as before once the file holds at least one such entry. "Enrolled and clean" IS that — a file with at least one `jterrazz-check/*` key. Where the checker has nothing to report, no such key can ever be written, so the first finding it ever raises is read as debt to enrol rather than the file staying silent forever; that is the accepted limit of a file with no sentinel key for "the checker ran and found nothing".

Where the file holds those entries, it is the **Test Conventions pass's verdict too**, not only the linter's. Both reporters were counted into one file, so refusing in that pass what the ratchet just held would fail the same debt twice. The pass's own runs still print what they found — recorded debt a reader cannot see is debt nobody pays — under a line naming the file that is holding it. A `jterrazz-check/*` breach — the enrolment notice above among them — is reported and failed there, never under `Oxlint Check`: that pass speaks for `oxlint`'s own rules alone.

`fix` is judged by the same file as `check`, on the diagnostics that SURVIVED its rewrite — so the pair reads the same verdict on the same tree. Judging only `check` made `fix` print a raw failure on every project carrying a baseline, and `make fix && make check` read red then green. The pair reads the same tree where there is NO file either: both count the diagnostics, both print the same lines, and neither reads severity.

### Recording it

```bash
typescript baseline
```

A command of its own, because it neither checks nor repairs: it writes down where the project actually stands. `fix --baseline` would bury the rewrite of a tracked file inside the gesture a developer runs twenty times a day. The file is written from the current counts, then handed to the project's own oxfmt — it is tracked like any other file, so the formatter owns its shape.

This package keeps NONE, and that is the ratchet's own rule showing: turning type-aware linting on found seven diagnostics in its own source, the seven were fixed rather than recorded, and an entry at zero is an entry that goes. The toolchain is consumer #1 of the rulebook it ships, so its own tree is the one place the debt is never carried.

## The Publish (packaging) pass

Every mistake this pass refuses is invisible in the repository and fatal in the registry: an `exports` entry pointing at a file nobody built, a subpath left out of `files` so it resolves in development and 404s in a consumer, a type declaration a modern resolver cannot see.

It runs once per package the registry would accept — one that names an entry (`exports`, `main`) or a `publishConfig` and never says it is `private`. A private package, and a workspace root that only holds members, have no tarball to be judged on.

| Rule                     | Refuses                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `publish-exports-target` | an `exports`, `main` or `types` target that is not on disk |
| `publish-files`          | a target `files` does not reach — it 404s in a consumer    |

Beside them run `publint --strict` on the packed tarball and `attw --pack . --profile esm-only` on the declarations, and each prints its own report verbatim when it refuses.

The two rule ids overlap publint on purpose. They read the SOURCE TREE and it reads the TARBALL, which means they answer where npm is not reachable and they keep a stable id whatever publint's wording does next. A gate's vocabulary is its own.

**Both tools are dependencies of this package rather than tsdown flags.** tsdown 0.23 can run them behind `--publint` and `--attw`, but only during a build — and `check` has to judge a package that does not build, which is exactly what this one is.

## The Architecture (layer map) pass

oxlint's `no-restricted-imports` reads a path and a pattern; dependency-cruiser resolves the module graph, which is the only way to see a cycle running through three files or an edge hiding behind a barrel. Where a project declares a map — `.dependency-cruiser.cjs`, `.js` or `.mjs` at its root — this pass reads it, and where it does not the pass never runs: a project with no declared architecture is not in breach of one.

**The rule ids are the config's own `name`s.** This is the one gate of the toolchain whose vocabulary the consumer writes, and that is the point: a layer map is a project's own architecture, so its rules are named for it.

A cruise starts from `src/` wherever there is one, and from whichever of `apps/`, `packages/` and `lib/` exist otherwise — a map never has to restate the shape of the tree it is about.

`dependency-cruiser` declares a `typescript <7` peer, and this tree satisfies it: the ordinary `typescript` dependency here is the ^6 JavaScript compiler API that typedoc and perfectionist already need ([Architecture](01-architecture.md)). That is also why the TS7 Go compiler stays out of `node_modules` under the name `typescript`.

## The Astro (check + format) pass

`.astro` is the one file shape oxfmt does not parse, and `astro check` is the only checker that reads a template's frontmatter. So where a project depends on `astro`, the pass runs both: the project's own `astro check`, and `prettier` over every `.astro` file.

**`prettier` and `prettier-plugin-astro` are dependencies of THIS package**, with a config derived from the oxfmt values — 100 columns, 4 spaces, single quotes, trailing commas everywhere. Five Astro consumers declare prettier today, each with its own copy of those numbers; after this, none of them declares a formatter at all.

The plugin is handed to prettier as a resolved path rather than as a name in the config, because prettier resolves a plugin name from the working directory — and the working directory is the consumer's, which is precisely the project that no longer declares it.

Both halves run in `fix` too: prettier writes, `astro check` is read-only wherever it runs. The pass speaks on success in fix mode alone, because there it rewrote files the operator owns.

## The drift report

Not a pass: a report, printed at the end of every `check` that has an oxlint config to read. Four numbers, because the alternative is what the estate had — twenty-eight repositories each quietly a little further from the shared rulebook, and nobody able to say by how much without opening twenty-eight config files.

```text
 DRIFT  Deviations from the profile

  profile               node
  rules off vs profile  none
  suppressions          2
  baseline              7
  tool versions         in range
```

A rule turned off, a suppression written, a baseline entry recorded and a tool left behind are the four ways a project drifts, and each of them is one line. `--json` prints the same reading for a machine, which is how a fleet-wide sweep collects the table.

**The profile is read off the consumer's config, and a config that names none is NOT measured.** A project extending no profile of this package is not drifting from one, it never joined it, and reporting two hundred rules as "off" would say nothing about anything. The name comes from the config's own `import`, which is the only evidence there is: oxlint's config schema is closed, so a compiled profile cannot carry its own name through to `--print-config`.

The versions line reports only what deviates. The full table is `typescript doctor`'s, and printing it on every run would put a number that changes with every dependency bump in front of a reader looking for what changed in their own tree.

### The one thing it refuses

`drift-unreasoned`: a rule the profile has ON, turned off by the consumer's config, with no `// reason:` comment on the line that turns it off.

A project may know things the profile does not, so turning a rule off is allowed. Doing it silently is not: the reason is what the next reader — or the next bump — needs, and a config line is where it belongs. Everything else in the report only ever reports.

## The Suppressions (directives) pass

Every place the project told a checker to look away. A suppression is a decision, and a decision the next reader cannot re-derive is a defect waiting to be re-introduced, so three rules hold the whole surface.

| Rule                    | Refuses                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `suppressions-spelling` | an `eslint-disable*`, a `biome-ignore` or a `@ts-ignore` — none of those run here |
| `suppressions-reason`   | an `oxlint-disable*` with no `-- reason`, or a `@ts-expect-error` with no text    |
| `suppressions-dead`     | a directive naming a rule the resolved config does not have on                    |

A directive is read only where a checker reads one: at the OPENING of a comment. Prose about a suppression, and a string carrying its spelling — the gate's own source is made of both — is not a suppression, and neither oxlint nor tsc would treat it as one.

`suppressions-dead` asks `oxlint --print-config` for the project's resolved rules, and that map holds what the config DECIDED rather than oxlint's whole catalogue: a rule missing from it is a rule this project does not run, which is the only question being asked. The map is resolved PER FILE, the way oxlint resolves it: the top-level `rules`, then every `overrides` entry whose globs match that path, in the order they were written, the last one winning. A rule armed only in an override — a test-file rule, a layer's `no-restricted-imports` — is therefore live inside the files that override names and dead outside them, and a rule one override turns off and a later one arms again is live wherever the later one reaches. A JS plugin's rules never appear there at all, so a directive naming one — `jterrazz/b9w-product-command`, say — is left alone rather than called dead on evidence the gate does not have. That holds for the whole namespace, `allow` entries and all: a config that turns three of the plugin's rules off puts those three names in the map and still none of the live ones, so a namespace the printed `plugins` list does not carry answers nothing.

### What `typescript fix` rewrites

Two spellings, both mechanical. An `eslint-disable*` becomes `oxlint-disable*` when every rule it names is one this project runs — a name that means nothing here is a directive whose intent only its author knows. A `@ts-ignore` becomes `@ts-expect-error`, which is the same suppression plus a failure when the error it was covering is gone.

It never invents a reason, and it never deletes a directive: both are the author's judgement, and a rewrite that guessed either would be worse than the report.

## The Markdown (prose) pass

Every tracked `*.md` outside `docs/reference/` and outside any `_`-prefixed row — a fixture, a golden, a template, all of them another project's tree — is read for two things: whether its coordinates resolve, and whether its blocks breathe.

| Rule                    | Refuses                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `markdown-link-missing` | a relative link whose target is not on disk                                |
| `markdown-path-missing` | a backticked repo-relative path naming nothing on disk                     |
| `markdown-block-long`   | a paragraph, or one list item, running past twelve lines                   |
| `markdown-fence-long`   | a fenced block running fifteen lines with no blank one in it               |
| `markdown-section-flat` | a `##` section over thirty prose lines carrying neither a `###` nor a list |

The three numbers are the readability floor of the shared doctrine, not the craft it asks for: the gap between them is a reader's pass, not a red gate. They are named constants at the top of the gate, and no page keeps a second copy of them.

The backtick rule reads a closed roster of opening segments — `apps/`, `bin/`, `lib/`, `packages/`, `presets/`, `specs/`, `tests/` — because without one every `a/b` in a sentence would be read as a coordinate. `docs/` and `src/` are deliberately off it: every repository has both, so a page teaching a convention writes `src/index.ts` about the READER's tree, not about its own. A relative LINK into either is still judged, because that one names a real target.

## The Names (tree) pass

What a project calls its own parts, swept under the roots where a project keeps what it wrote: `apps/`, `bin/`, `lib/`, `packages/`, `specs/`, `src/`, `tests/`. Each root's OWN name is the toolchain's vocabulary rather than the project's choice, so it is never judged — `lib/` sits on this list and on the grab-bag roster at once, and only what a project put inside it is the project's to name. A directory below an `app/` router root is a Next.js route segment — a URL the product serves, not a name the tree chose — and is not judged either; the files inside it still are.

| Rule             | Refuses                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `names-grab-bag` | a directory or file stem that says nothing: it holds what nobody placed |
| `names-shortcut` | a name, or one hyphen segment of it, written in half                    |

Both rosters are closed and both live in the gate, in one executable copy. Grab-bag: `base`, `common`, `core`, `helpers`, `lib`, `misc`, `shared`, `stuff`, `tools`, `utils` — a leading `_` exempts one, because it marks a row rather than a subject. Shortcut: `auth`, `cfg`, `impl`, `infra`, `k8s`, `pkg`, `repo`, `repos`, `svc`, `tmp` — and the `_` marker does NOT excuse one, since it states a position, not whether the name is whole.

## The Secrets (credentials) pass

No file the project would commit carries a live-looking credential. Two engines answer that one question: where `gitleaks` is on PATH it runs as `gitleaks dir . --no-banner --redact`, so a finding names the file and never reprints the secret; where it is not, ten patterns over the tracked text answer well enough to stop the leak that actually happens — a token pasted into a note and committed with it.

Which engine runs is decided inside the gate rather than in `check.sh`, because the gate applies either way. Bash decides whether a pass applies; this one always does, and what changes is only who answers.

| Rule                    | Looks like            |
| ----------------------- | --------------------- |
| `secrets-private-key`   | a private key block   |
| `secrets-aws-key`       | an aws access key     |
| `secrets-github-token`  | a github token        |
| `secrets-slack-token`   | a slack token         |
| `secrets-tailscale-key` | a tailscale key       |
| `secrets-jwt`           | a signed jwt          |
| `secrets-grafana-token` | a grafana token       |
| `secrets-api-key`       | an api key            |
| `secrets-iban`          | a bank account number |
| `secrets-service-token` | a service token       |

**There is no exception list, and there will not be one.** A hit is forgiven by exactly one thing: the same line declaring itself `fake`, `dummy`, `example`, `sample`, `synthetic` or `redacted`. A path allow-list is the first place a real leak hides, so the only way to silence this gate is to make the line say what it is.

## The Docs (sync) pass

Once a project has generated its committed docs, `check` guards them: it regenerates the projections into a temp dir and diffs them against what is committed. A drift — a hand-edited reference file, a chapter changed without regenerating — fails the pass and tells you to run `typescript docs`. See [Docs pipeline](08-docs-pipeline.md).

## Pitfalls

- **A nested `oxlint.config.*` is LOADED wherever it sits.** oxlint discovers every config under the project and loads them all before it lints anything — `ignorePatterns` decides which FILES are linted, never which configs are read. So a fixture tree carrying a config that cannot load fails the parent project's own run, and a project whose specs stand on consumer projects writes those configs at run time instead of committing them ([Testing](03-testing.md)).
- **An ignore without a reason is the expected form of nothing.** Every entry in the project's `knip.json` tells the gate to overlook something, and the next reader has to re-derive why. The file is read as JSONC, so the reason goes beside the entry as a `//` comment — that is the form this toolchain expects, and the shape of the file is [Lint presets](07-lint-presets.md)'s.
- **An export used in its own file is not dead.** The base preset sets `ignoreExportsUsedInFile: true`, so the A4 idiom's same-file `cleanup` and a capsule's flags read back by its sibling test never need a project-local `knip.json` line to stay unreported.
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.
- **Knip runs uncached, on purpose.** Its `--cache` would be the obvious speed-up and it can lie: a cached glob is validated against the mtimes of the directories that held a match, so a file added to a directory that held none is invisible, and the cached run passes a project the uncached run fails. Every other cache in the toolchain — tsc's buildinfo — is keyed on content and cannot.

## Related

- [Lint presets](07-lint-presets.md) — oxlint presets, compose, architecture.
- [Docs pipeline](08-docs-pipeline.md) — what the Docs pass checks.
