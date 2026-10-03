# ADR-018: A project declares what it is, and every config follows

**Status:** Proposed
**Date:** 2026-10-03

## Context

A project chose a profile — `typescript({ profile })` — and then wrote the
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

- `jterrazz.config.ts` declares the project in two closed unions: `kind`
  (`library`, `api`, `cli`, `website`, `mobile`, `workspace`) and
  `platform` (`node`, `bun`, `react`, `next`, `astro`, `expo`), with the
  platforms each kind may run on typed. The base preset, the lint profile,
  the tsconfig preset, the roots a framework imposes and the checks follow
  from them; `typescript()` and the profile choice are gone.
- The files an editor discovers by name stay at the root as derived lines:
  `oxlint.config.ts` and `oxfmt.config.ts` re-export the `./oxlint` and
  `./oxfmt` entries, which derive the config from `jterrazz.config.ts` in
  the directory the tool runs in, and `tsconfig.json` extends the
  platform's preset, with what `typescript.tsconfig` adds and why. The
  Config (one file) pass refuses any other content, and `fix` writes them.
- Each integration was run as the editor runs it before the form was cut
  to one line: `oxlint --lsp` and `oxfmt --lsp` load the re-export from
  the worktree root, the TypeScript 7 language server resolves the
  `extends`, and the Vitest extension loads its config from the config's
  own directory. One integration refused the bare re-export: knip skips a
  config that only re-exports from a package, so a sibling preset's
  `vitest.config.ts` imports a call and default-exports it.
- A tool only the command runs keeps no config: the command derives knip's,
  tsdown's and Stryker's from the manifest and `jterrazz.config.ts`, where
  every setting maps to its reason (`typescript.knip`, `typescript.build`,
  `typescript.mutation`, `typescript.oxlint`, `typescript.oxfmt`). `build`
  reads its entries off the manifest and builds a `.cjs` target as well;
  `bundle` is gone.
- A workspace declares no platform: its root `oxlint.config.ts` scopes each
  member's own derived config to the member's folder, and a member keeps no
  `oxlint.config.ts` or `oxfmt.config.ts` of its own.
- Everything regenerable lives under `.artifacts/`; the debt the ratchet
  holds lives under `.jterrazz/`, tracked, and goes when it is paid. oxlint
  takes no path for its suppressions file, so the command stages
  `.jterrazz/oxlint-suppressions.json` at the root for the length of a run.

## Consequences

- A project's root reads as what a person wrote: the declaration, the
  manifest, three derived lines, and its own code and manual.
- A setting can no longer be set without a reason, nor in two places.
- An editor and `check` judge alike, since both load the one derived config;
  an editor's oxlint does not read the suppressions ledger, so held debt
  still shows there.
- `isolatedDeclarations` left with the `bundle` preset: it fights
  `no-inferrable-types` on an exported template literal or regular
  expression, so a library's declarations are emitted with the
  type-checker, which refuses an inferred type it cannot name.
- Every repository moves in the release that carries this record: no bridge
  reads `typescript()`, `fromPresets`, a `knip.json` or a
  `tsdown.config.ts`.
