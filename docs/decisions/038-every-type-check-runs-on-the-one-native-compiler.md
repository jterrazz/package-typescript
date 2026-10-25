# ADR-038: Every type-check runs on the one native compiler

**Status:** Accepted
**Date:** 2026-10-25

**Accepted:** 2026-10-25: the owner's word ("ok pour tout, go tout update et terminer").

The owner asked for it on 2026-10-25: move the `typescript check` type-check
from the TypeScript 7.0.2 binary to the 7.1 beta already installed for the
mutant checker, under the waiver of the two-week age rule for the native
TypeScript.

## Context

Since [ADR-032](032-the-mutant-checker-runs-on-the-native-compiler.md) the
package installed two Go compilers. `typescript check` and `typescript tsc`
ran 7.0.2, from the seven per-platform `@typescript/typescript-*`
optionalDependencies at `^7.0.2`. The mutant checker ran 7.1.0-beta, through
`@typescript/native`, an npm alias of `typescript@7.1.0-beta`, whose own
optionalDependencies are the same platform packages at `7.1.0-beta`. A tree
could then be judged by one compiler and its mutants by another.

Measured on 2026-10-25, each compiler run as the pass runs it
(`--noEmit --pretty false`) on four projects installed from their lockfiles
(this package, `@jterrazz/test`, jterrazz-web, signews-api):

- the diagnostics are the same, line for line: none on each built tree; 10, 6,
  4 and 83 on the same trees before their build and generated types; 8 on a
  file written to break eight ways, placed in two of them;
- the 7.1 beta is faster or level, and lighter on each: over three
  interleaved runs, 0.32-0.42 s against 0.37-0.40 s here, 0.61-0.70 s against
  0.75-1.12 s on `@jterrazz/test`, 0.33-0.43 s against 0.43-0.56 s on
  jterrazz-web, 0.29 s against 0.32-0.35 s on signews-api; its peak memory
  354 against 454-464 MB, 539-557 against 690-730 MB, 340-369 against
  432-478 MB, and 331-335 against 404-410 MB;
- a run that reports an error exits 2 on the beta, 1 on 7.0.2.

## Decision

- `typescript check` and `typescript tsc` run the binary of
  `@typescript/native`: the platform package it depends on, resolved from
  that package's own folder, since npm hoists it or nests it beside it.
- The seven `@typescript/typescript-*` optionalDependencies leave the
  manifest: the toolchain declares one TypeScript 7, the alias, and its pin
  is the version of every type-check it runs.
- `typescript doctor` reports that alias's version on its `tsc (Go)` row,
  against the version the alias names.

## Consequences

- The verdict of `check` rides a beta, as the mutant checker's already did.
  The pin moves for both at once, exactly, with a parity run of the
  diagnostics on these four projects.
- A consumer installs one Go compiler instead of two.
- A failing `typescript tsc` exits 2 where it exited 1. `check` reads any
  non-zero status as a failure, so its verdict is unchanged; a script that
  tests for exactly 1 sees the change.
- An editor pointed at `node_modules/@typescript/typescript-<os>-<arch>`
  finds the beta there once nothing else in the tree asks for 7.0; until
  then npm nests the beta under `node_modules/@typescript/native/`.
