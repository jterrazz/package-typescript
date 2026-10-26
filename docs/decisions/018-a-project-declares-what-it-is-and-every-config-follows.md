# ADR-018: A project declares what it is, and every config follows

**Status:** Accepted
**Date:** 2026-10-03
**Amended by:** [ADR-021](021-a-package-standard-is-data-and-the-settings-file-holds-its-exceptions.md), for the defaults: they are each package's standard, and `typescript.build` is gone; [ADR-024](024-a-monorepo-is-the-repositorys-shape-read-from-workspaces-never-a-kind.md), for the kinds: `workspace` is no kind, and a monorepo is read from `workspaces`.

## Context

A project chose a profile (`typescript({ profile })`) and then wrote the
same choice again in every file a tool reads: the `extends` of its
`tsconfig.json`, an `oxlint.config.ts` composing `fromPresets`, an
`oxfmt.config.ts`, a `knip.json` of JSONC reasons, a `tsdown.config.ts`
choosing between `build` and `bundle`, a `stryker.config.json` and its
Vitest config. Each file could drift from the others and from the profile,
and each was a place a setting could hide without a reason. The profile
said which rules apply, but nothing said what the project WAS, so whether
it owed `exports` or a `bin`, which build it took and which roots its
framework imposed were all answered file by file. The root mixed what a
person wrote with what a tool regenerates, and the ledgers of debt sat
beside both.

## Decision

- `studio.config.ts` declares the project in two closed unions: `kind`
  (`library`, `api`, `cli`, `website`, `mobile`, `workspace`) and
  `platform` (`node`, `bun`, `react`, `next`, `astro`, `expo`), with the
  platforms each kind may run on typed. The base preset, the lint profile,
  the tsconfig preset, the roots a framework imposes and the checks follow
  from them; `typescript()` and the profile choice are gone.
- The files an editor discovers by name stay at the root, derived:
  `oxlint.config.ts` and `oxfmt.config.ts` hand their own
  `import.meta.url` to the `oxlintConfig` and `oxfmtConfig` of the
  `./oxlint` and `./oxfmt` entries, which derive the config from the
  `studio.config.ts` of the module's directory. They hand the `url`, since a
  browser platform's types declare no `dirname`, and jiti, which knip
  loads configs with, rewrites `import.meta.url` to the file's own but
  hands the bare `import.meta` over as its wrapper's. The Config (one
  file) pass refuses any other content, and `fix` writes them.
- `tsconfig.json` extends the platform's preset, with what
  `typescript.tsconfig` adds and why; and a project on `@jterrazz/test`'s
  preset keeps the `vitest.config.ts` it derives, of the same shape
  (`export default await vitestConfig(import.meta.url)` from
  `@jterrazz/test/vitest`), which vitest and knip's loader, jiti's async
  import, both read.
- The config files name their directory because nothing else can: a bare
  re-export derived from the directory the tool runs in, so oxlint started
  in `src/` dropped every preset and setting with no error, and Node loads
  the entry once per process, so a language server serving two projects
  would have handed both the first one's config. oxlint imports the config
  file itself afresh, which is the one module that knows where it lies.
- Each integration was run as the editor runs it: `oxlint --lsp` started
  at the project root loads the config and reports the profile's rules,
  `oxfmt --lsp` started there formats a file at the root and one in
  `src/presets/` by the derived config (four spaces, single quotes) where
  a folder with no config gets its defaults, the TypeScript 7 language
  server resolves the `extends`, and the Vitest extension loads its config
  from the config's own directory.
- The oxlint language server watches its own config names, never
  `studio.config.ts`, so an edit of the declaration reaches it when it
  reloads, on a save of `oxlint.config.ts` or a restart. The reader
  imports the declaration afresh whenever its mtime changes, since Node
  would hand a reload the first import; a rule that reads settings while
  it lints keeps its first read until the server restarts.
- Started on a folder above the project, oxlint (CLI and language server alike) finds
  the project's config as a nested one, refuses the `options.typeAware` the
  config sets, and lints with its own defaults: an editor is opened on the
  project. knip skips a config that only re-exports from a package, which
  the forms above never do.
- A tool only the command runs keeps no config: the command derives knip's,
  tsdown's and Stryker's from the manifest and `studio.config.ts`, where
  every setting maps to its reason (`typescript.knip`, `typescript.build`,
  `typescript.mutation`, `typescript.oxlint`, `typescript.oxfmt`). `build`
  reads its entries off the manifest and builds a `.cjs` target as well;
  `bundle` is gone.
- A workspace declares no platform: its root `oxlint.config.ts` scopes each
  member's own derived config to the member's folder, and a member keeps no
  `oxlint.config.ts` or `oxfmt.config.ts` of its own.
- Everything regenerable lives under `.artifacts/`; the debt the ratchet
  holds lives under `.studio/`, tracked, and goes when it is paid. oxlint
  takes no path for its suppressions file, so the command stages
  `.studio/oxlint-suppressions.json` at the root for the length of a run.

## Consequences

- A project's root reads as what a person wrote: the declaration, the
  manifest, the derived editor files, and its own code and manual.
- A setting can no longer be set without a reason, nor in two places.
- An editor opened on the project and `check` judge alike, since both load
  the one derived config;
  an editor's oxlint does not read the suppressions ledger, so held debt
  still shows there.
- `isolatedDeclarations` left with the `bundle` preset: it fights
  `no-inferrable-types` on an exported template literal or regular
  expression, so a library's declarations are emitted with the
  type-checker, which refuses an inferred type it cannot name.
- Every repository moves in the release that carries this record: no bridge
  reads `typescript()`, `fromPresets`, a `knip.json` or a
  `tsdown.config.ts`.

## Amendment (2026-10-15): a monorepo is no kind

**Accepted:** 2026-10-15: the owner's word, recorded in [ADR-024](024-a-monorepo-is-the-repositorys-shape-read-from-workspaces-never-a-kind.md).

`kind` is `library`, `api`, `cli`, `website` or `mobile`: `workspace` left
the union. A monorepo is read from the root manifest's `workspaces`, and its
root declares no kind and no platform, its config holding the repository's
settings alone. The bullet above on a workspace's root `oxlint.config.ts`
stands for the root of a monorepo: it still scopes each member's own
derived config to the member's folder.
