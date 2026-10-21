# ADR-032: The mutant checker runs on the native compiler

**Status:** Accepted
**Date:** 2026-10-20
**Accepted:** 2026-10-21, for the alias rule: the owner's word on the review ("Tout ok"), that `typescript@7` never enters the tree under its own name and its API only under the alias.

The owner asked for it on 2026-10-20 ("ça serait possible dès ajd le
vérificateur stryker natif sur la version beta ?"), under the standing go of
the same day ("fais toutes les optis") and the waiver of the two-week age
rule for the native TypeScript and the tools that type-check.

## Context

`typescript mutation` type-checks every mutant before a test runs it, and a
mutant the compiler refuses is a `CompileError` no test owes anything. Until
now that was Stryker's TypeScript checker, which drives the JavaScript
compiler, TypeScript 6, through its watch builder: 61 to 132 ms per mutant
on this package. `typescript check` has run the Go compiler, TypeScript 7,
since July, but 7.0 shipped no API a checker could call, and the watch
builder the Stryker checker needs is gone from 7.

TypeScript 7.1 beta, published on 2026-10-20 as `typescript@7.1.0-beta`,
is the API release: `typescript/sync` opens a project from its
`tsconfig.json` in a native process, keeps snapshots of it, and checks a
snapshot with one file's text replaced
(`runWithTemporaryFileUpdate`). It reads diagnostics per file and emits a
file's declarations on demand. It has no watch and no incremental builder.
Stryker 10's own checker carries an experimental native mode on 7.0's
unstable API, which checks the whole program for every mutant.

While it checks, Stryker 10 holds half of a stage's processes as checkers
([ADR-031](031-every-pool-is-sized-from-one-leased-capacity.md)), so a
checker's speed is runner slots as much as seconds. Measured on this
package's own `typescript mutation`, cold, over the sixteen sources of
`src/commands/mutation/` (1,080 mutants), on a laptop other sessions
loaded: the module stage ran in 504.5 s on 8 test runners beside 4 checkers
with the old checker, and in 135.6 s on 5 runners beside 3 with the native
one. The same stage with no checker could not be compared: the machine's
other gate left it 0.4 GB, one runner, 701.4 s.

## Decision

- The toolchain ships its own Stryker checker, `typescript-native`, built
  from `src/index.mutant-checker.ts` into the `#mutant-checker` private
  import, which `typescript mutation` hands Stryker by path. It replaces
  `@stryker-mutator/typescript-checker`, which leaves the dependencies; no
  flag selects either, one code path.
- It opens the project once per checker process, from its `tsconfig.json`,
  with the options Stryker's checker forced: unreachable code and unused
  locals and parameters allowed. It refuses to start on a tree that holds an
  error, as the old one did, with the same lesson the run prints.
- A mutant is checked on a snapshot with its file's text replaced: that
  file's syntax and types first; then, as TypeScript's builder decides what
  a change affects, the files that import a file whose emitted declarations
  the mutant changed, and so on outward while the declarations keep
  changing; every file where the mutated one is a script or augments a
  module, since no import bounds what it reaches. The import graph is read
  once, from the program.
- `firstCompileError`, the headline a run prints when the checker stopped
  it, is read by the same native project, so the run names the error the
  checker refused on.
- The API comes from `@typescript/native`, an npm alias of
  `typescript@7.1.0-beta`, pinned exactly. `typescript` itself stays 6 for
  the tools that need its JavaScript API.
- `typescript@7` never enters the tree under its own name: the 7 API is
  reached only through the alias.
- The checker's seed price is the most its process and the native
  compiler's held together over the runs below, 720 MB, where the seed was
  400 MB.

## Consequences

- Its verdicts are the old checker's. Measured on 2026-10-20, both checkers
  over every mutant Stryker makes of this package's `src/` and `lint/`
  (21,543, `lint/self/` left out as the run leaves it) and of jterrazz-web's
  `src/` (5,207), each mutant then run by a command that passes: the same
  6,496 and 1,584 mutants are `CompileError`, mutant for mutant, and no
  other. On two checkers each, on a laptop other sessions loaded, the native
  checker took 399 s and 178 s, the old one 3,383 s and 1,371 s: 8.5 and 7.7
  times faster. A mutant took 22.6 ms at the median on this package, 68 ms
  at the 90th percentile, 173 ms at the 99th; 26, 110 and 959 ms on
  jterrazz-web.
- A beta carries the checker. Its API may change before 7.1 is stable, and
  the pin moves with a measured parity run, never by range.
- The architecture's rule against a second package named `typescript` is
  thereby narrowed to its name, which the alias is safe beside: the July hijack (6.1.1) came from a `typescript@7`
  that pnpm's hoist fallback could hand perfectionist. Measured on
  2026-10-20 under pnpm 9.15.9, alone and in a workspace, with this
  package's tarball installed: the hoisted `typescript` is 6.0.3, and
  perfectionist 5.13.0, which declares `typescript` as a peer, resolves
  6.0.3.
- A checker process holds the native compiler beside it, and weighs less
  than the old one: its process and the compiler's peaked at 657 to 721 MB
  over those runs, where the old checker grew to 1.6 to 2.0 GB.
- Stryker still splits one concurrency into checkers and runners; only a
  release of Stryker with a separate checker count would let the runners
  take the whole slice from the first mutant.
