# Quality checks

`typescript check` runs every quality gate in parallel; `typescript fix` auto-repairs what it can.

Output is quiet on success and verbose on failure — a tool's captured log is printed only when it fails, so green runs stay byte-identical across platforms.

The toolchain measures from the nearest `package.json`: a workspace root runs each per-package gate once per member, and a single-package project is the same run it always was.

## The passes

`typescript check` runs up to six passes. The first four always run; the last two are opt-in — they appear only when the project qualifies.

| Pass                              | Tool                      | When it runs                                                 |
| --------------------------------- | ------------------------- | ------------------------------------------------------------ |
| TypeScript Check                  | tsc (TypeScript 7, Go)    | always                                                       |
| Oxlint Check                      | oxlint (Rust)             | always                                                       |
| Oxfmt Check                       | oxfmt (Rust)              | always                                                       |
| Knip (unused code)                | knip (Node)               | always (check only — it is not run in fix)                   |
| Test Conventions (@jterrazz/test) | conventions checker       | per package that depends on `@jterrazz/test` + owns `specs/` |
| Docs (sync)                       | `typescript docs --check` | per package that has committed docs (`docs/reference/`)      |

`typescript fix` runs tsc, oxlint (`--fix`), and oxfmt in parallel — knip, the conventions checker, and the Docs pass are check-only (they are read-only gates, not fixers).

### In a workspace

When the `package.json` at the cwd declares `workspaces`, the two per-package passes run once per member that qualifies — `apps/*/specs`, `packages/*/docs/reference` and the rest are gates of their own, not files the root happens to contain. A member is a directory a workspace glob matches that holds a `package.json`; the pass reports one line and prints the log of any run that failed.

The other four passes are root-only, and that is not an omission. tsc, oxlint and oxfmt measure from their **config file**, not from a package, and each already walks the whole tree from the cwd. Knip reads the workspace globs itself and reports per member from a single run, so a second invocation per member would only double-report.

## The Docs (sync) pass

Once a project has generated its committed docs, `check` guards them: it regenerates the projections into a temp dir and diffs them against what is committed. A drift — a hand-edited reference file, a chapter changed without regenerating — fails the pass and tells you to run `typescript docs`. See [Docs pipeline](05-docs-pipeline.md).

## Pitfalls

- **A CommonJS `oxlint.config.js` silently drops the `@jterrazz/test` plugin.** oxlint loads the ESM-only plugin, prints a warning, and still exits 0 — so none of the `jterrazz/*` rules run. `check` warns loudly when it detects this; use an ESM config (`oxlint.config.ts` or `.mjs`).
- **Knip is check-only.** Fix mode never runs it because its remedies (deleting exports, files, deps) are destructive.

## Related

- [Lint presets](04-lint-presets.md) — oxlint presets, compose, architecture.
- [Docs pipeline](05-docs-pipeline.md) — what the Docs pass checks.
