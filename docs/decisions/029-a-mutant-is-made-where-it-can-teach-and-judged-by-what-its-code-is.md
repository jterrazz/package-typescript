# ADR-029: A mutant is made where it can teach, and judged by what its code is

**Status:** Accepted
**Date:** 2026-10-20

The direction is the owner's, given 2026-10-17 ("ok ajoute 1 2 3 4", then
"ok" to 5 and 6), and the shape below was accepted under the owner's
delegation of 2026-10-19 ("fais au mieux pour tes questions je te fais
confiance"): the TypeScript checker, ignorers for log calls, string
literals left unmutated where a golden pins them, two bars, the Google
model and the Meta model.

## Context

The module stage mutated every source that has a module test, whole, on
every cold run: 10,287 mutants in 18 minutes here and 24,478 in two hours in
`@jterrazz/test`, though CI runs cold and a release commit changes no line.
The suite stage already measured only the change
([ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md)).

About a third of the mutants Stryker made could not compile: a sample of
2,420 here and 2,267 in jterrazz-web, each type-checked in memory, read
31.9 % and 28.6 %, a lower bound. Each one ran tests, and 181 of the 480
mutants this package declared equivalent were among them.

The verdict treated every line alike. A log call, a line of printed text a
golden already compares whole and a pricing rule each cost a run and owed an
assertion or a declaration. In jterrazz-web, 1.9 % of the mutants sit in
`domain/`; the rest are adapters and presentation, held to the same zero.

## Decision

- Both stages mutate the lines the change reaches, nothing else. A line no
  test covers gives `NoCoverage` and is counted, never judged. A whole-tree
  measure is `--since` the repository's first commit. Where git cannot say
  what changed, the module tests measure every source they test, whole.
- Every run of a project that keeps a `tsconfig.json` type-checks each
  mutant it would run (Stryker's TypeScript checker, grouped): one that does
  not compile is `CompileError`, outside the verdict, before any test.
- A diagnostic log call is never mutated: a statement calling `console.*`,
  or a log level on a receiver named `log`, `logger` or ending in `Logger`.
  Printed output is mutated: in a command it is the product, and its specs
  judge it.
- A file is domain or glue. Glue is `infrastructure/`, `composition/` and
  `presentation/` at any depth, and what the project declares under
  `typescript.mutation.glue`, each glob with its reason; everything else is
  domain. Domain keeps zero survivors. Glue fails the run when the share of
  the glue mutants a test ran that a test detected falls under the bar, a
  law of the standard (0.9 for every kind); every glue survivor is printed.
- What `typescript.mutation.presentation` declares, each glob with the
  reason naming the golden that pins its text, is glue whose string literals
  are not mutated, unless a string is compared, keys a member or names a
  module. The standard names no presentation file.
- A change's glue mutants beyond the standard's cap (50) are not run: the
  ones run are the first by a stable hash of the mutant, so a cold and an
  incremental run measure the same ones. Domain is never capped.
- A survivor's triage is an agent's, never the gate's: the verdict file names
  each survivor with its replacement, its report and its role, and an agent
  declares an equivalence without review only once its precision against
  the vision 17 hand triage reaches 0.95.
- Lesson prose (the `why`, `fix` and `read` of a refusal) stays mutated, to
  be revisited once these numbers are in.

## Consequences

- The module stage of a branch costs its change: this branch's own gate
  measured 143 module mutants where the cold whole-file stage of the same
  package plans 10,132 (63ae8b8a, 18 min 47 s on four runners).
- The checker compiles the project before the first mutant and fails the
  run on a type error the compiler finds in the unmutated tree; while it
  checks, it holds half of the test runners.
- A glue survivor no longer fails the run by itself: the bar is a number
  again, for glue only. ADR-019's zero stands for domain. In jterrazz-web,
  98 % of the mutants are judged against the bar; in this package, none
  until it declares glue or presentation.
- A module test weakened by a change to the test alone is measured when a
  later change reaches the source, as ADR-020 already accepts for the specs.
- Amends [ADR-019](019-mutation-judges-zero-survivors-not-a-score.md) (the
  zero is domain's), [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md)
  (the module stage measures the change too) and
  [ADR-022](022-a-module-tests-survivor-is-the-suites-to-answer.md) (a
  module survivor stands on a changed line, since no other line is mutated).
