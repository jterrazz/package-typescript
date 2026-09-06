# Quality checks

`typescript check` runs every quality gate in parallel; `typescript fix` auto-repairs what it can.

Output is quiet on success and verbose on failure — a tool's captured log is printed only when it fails, so green runs stay byte-identical across platforms.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package gate once per member, and a single-package project is the same run it always was.

## The passes

`typescript check` runs up to seven passes. The first three always run; the rest are opt-in — they appear only when the project qualifies.

| Pass                              | Tool                      | When it runs                                                 |
| --------------------------------- | ------------------------- | ------------------------------------------------------------ |
| TypeScript Check                  | tsc (TypeScript 7, Go)    | always                                                       |
| Oxlint Check                      | oxlint (Rust)             | always                                                       |
| Oxfmt Check                       | oxfmt (Rust)              | always                                                       |
| Gitignore (artefacts)             | the artefact gate         | check: project or ancestor `.gitignore`; fix: project's own  |
| Knip (unused code)                | knip (Node)               | always (check only — it is not run in fix)                   |
| Test Conventions (@jterrazz/test) | conventions checker       | per package that depends on `@jterrazz/test` + owns `specs/` |
| Docs (sync)                       | `typescript docs --check` | per package that has committed docs (`docs/reference/`)      |

`typescript fix` runs tsc, oxlint (`--fix`), oxfmt and the artefact gate in parallel — knip, the conventions checker, and the Docs pass are check-only (they are read-only gates, not fixers).

### In a workspace

When the `package.json` at the cwd declares `workspaces`, the two per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/docs/reference` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed.

The other four passes are root-only, and that is not an omission. tsc, oxlint and oxfmt measure from their **config file**, not from a package, and each already walks the whole tree from the cwd. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

Discovery never leaves the workspace. A candidate is dropped when git ignores it — clones, workbenches and build output live under gitignored paths — and when the walk had to cross a nested `.git` or a `package.json` that no workspace glob claims to reach it: a vendored project's conventions are its own, not yours.

## The Gitignore (artefacts) pass

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root ([Getting started](01-getting-started.md)), and this pass reads that convention off two files: the project's own `.gitignore`, and the nearest ANCESTOR `.gitignore` above it — the workspace root's, found by walking up to the nearest directory holding a lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `npm-shrinkwrap.json`) or a `workspaces` manifest. It runs when either file exists — a project with neither names no artefact path — and each is judged by the same rules.

The second file matters in a workspace whose `lint` DELEGATES to members — each one calling `typescript check` on its own, cwd'd there. Without it, a member with no `.gitignore` of its own would pass silently even when neither it nor the root ever declared the convention: the pass is opt-in on a file's existence, and only the package's own file used to be asked. An ancestor's pattern counts only when it is not ANCHORED to the ancestor's own directory — `.artifacts/`, not `/.artifacts/` — the same rule git applies when deciding whether a pattern reaches into a nested directory; a root that ignores `.artifacts/` this way covers every member beneath it.

Three things fail it:

- **An artefact named outside `.artifacts/`** — `*.tsbuildinfo`, `.next` (see the conditional exception below), `out`, `build`, `coverage`, `target`, `test-results`, `playwright-report`, a `*.log`, `.vite`, `.turbo`, `.cache`, or `bin/` (a Go output). The message names the `.artifacts/<tool>/` home each one moves to, and which file — the project's own or the ancestor's — named it. A pattern is read by the segment that carries its meaning, so `packages/*/coverage` and `coverage/` fail alike.
- **`.artifacts/` not ignored by either file** — the convention's own directory must never reach a commit. When a workspace root exists, the message points at it — that is the shared file the fix belongs in.
- **A committed artefact** — a tracked `*.tsbuildinfo`, or a tracked file under `.artifacts/`, `.next/`, `.turbo/`, `.vite/`, `.cache/`, `coverage/`, `playwright-report/` or `test-results/`. The remedy is `git rm --cached`, and it stays yours: the pass never deletes a file git is tracking.

`dist` is the one exception the convention itself carves out — a build's product stays beside `src/` and is published from there.

### The closed exception list

These ignored paths are not artefacts of the convention, and the pass says nothing about them: `.expo/`, `ios/`, `android/`, `next-env.d.ts`, `.vercel`, `.build/`, `.swiftpm/`, `Package.resolved`, `DerivedData/`, `.gradle/`, `.metro-health-check*`, `node_modules/`. Each is a platform working directory a toolchain owns and cannot be told to move, or a file a framework expects at a fixed path. The list is closed: a path that is not on it and matches an artefact form fails.

One more exception joins the list CONDITIONALLY: `.next`, but only when the project's `next.config.*` declares `output: 'export'`. In that mode Next reads `distDir` as the export destination and keeps its working directory pinned at `.next` regardless — `next/dist/export/utils.js`'s `hasCustomExportOutput` refuses to move it, proven by a real consumer's static site. The pass reads the config file textually for `output:\s*['"]export['"]`; without a match — including when there is no `next.config.*` at all — `.next` stays an ordinary artefact whose home is `.artifacts/next/`.

### What `typescript fix` rewrites

Fix mode rewrites the package's OWN `.gitignore` only — never an ancestor's, which is a different project's file, and never one that does not exist, since fix repairs a file, it does not create one. The artefact lines go, `.artifacts/` arrives, and everything else — the comments, the blank lines, the order, the project's own paths — survives untouched. It reports every line it removed and prints the file's negations, which it never touches: a `!` line rescues a tracked file, so what to do with one is a judgement, not a rewrite. A committed artefact is reported in fix mode too and still fails the run — untracking a file is not something a formatter should decide.

## The Docs (sync) pass

Once a project has generated its committed docs, `check` guards them: it regenerates the projections into a temp dir and diffs them against what is committed. A drift — a hand-edited reference file, a chapter changed without regenerating — fails the pass and tells you to run `typescript docs`. See [Docs pipeline](05-docs-pipeline.md).

## Pitfalls

- **A CommonJS `oxlint.config.js` silently drops the `@jterrazz/test` plugin.** oxlint loads the ESM-only plugin, prints a warning, and still exits 0 — so none of the `jterrazz/*` rules run. `check` warns loudly when it detects this; use an ESM config (`oxlint.config.ts` or `.mjs`).
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.
- **Knip runs uncached, on purpose.** Its `--cache` would be the obvious speed-up and it can lie: a cached glob is validated against the mtimes of the directories that held a match, so a file added to a directory that held none is invisible, and the cached run passes a project the uncached run fails. Every other cache in the toolchain — tsc's buildinfo — is keyed on content and cannot.

## Related

- [Lint presets](04-lint-presets.md) — oxlint presets, compose, architecture.
- [Docs pipeline](05-docs-pipeline.md) — what the Docs pass checks.
