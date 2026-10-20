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
  are not mutated, unless a string is compared, is a `switch` case, keys a
  member or names a module. The standard names no presentation file.
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

- The module stage of a branch costs its change. Measured cold, four test
  runners, on four fixed changes, before (the toolchain at `fix/after-v17`)
  and after (this decision's first four parts, at `7226b7df`; the cap and
  the pinned text came later):

    | Change                 | Module stage before  | Module stage after                          | Suite mutants before / after |
    | ---------------------- | -------------------- | ------------------------------------------- | ---------------------------- |
    | this package, 63ae8b8a | 10,525 made, 1,127 s | 116 made (42 refused by the compiler), 82 s | 242 / 80                     |
    | this package, a682280d | 10,627 made, 1,033 s | 169 made (7 refused by the compiler), 193 s | 359 / 217                    |
    | jterrazz-web, 90f9f0a  | 1,189 made, 135 s    | 31 made; the checker stops on the old tree  | 25 / none                    |
    | jterrazz-web, dddc94b  | 1,191 made, 210 s    | 11 made, 22 s                               | 40 / 40                      |

    On the first three, the whole-suite stage fails its dry run before and
    after alike: an old commit's specs against today's `@jterrazz/test` 17,
    so only the module stage, and the suite's count of mutants made, compare.
    On jterrazz-web at dddc94b both runs pass: 971 mutants detected before,
    27 after (glue 27 of 27), in 386 s against 222 s. The machine ran other
    gates meanwhile, so the seconds are an order of size, not a benchmark.

- The checker compiles the project before the first mutant and fails the
  run on a type error the compiler finds in the unmutated tree; while it
  checks, it holds half of the test runners. The run names the compiler's
  first error at its file and line and never falls back to running the
  mutants unchecked (the orchestrator's decision under the owner's
  delegation, 2026-10-20): a tree that does not compile is already red at
  the gate's TypeScript Check, and a fallback would only hide it. An old
  commit measured against today's packages meets exactly this: jterrazz-web
  at 90f9f0a stops before its first mutant.
- A glue survivor no longer fails the run by itself: the bar is a number
  again, for glue only. ADR-019's zero stands for domain. In jterrazz-web,
  98 % of the mutants are judged against the bar; in this package, the
  three it declares presentation: the check report, the doctor and the
  mutation verdict.
- A module test weakened by a change to the test alone is measured when a
  later change reaches the source, as ADR-020 already accepts for the specs.
- Amends [ADR-019](019-mutation-judges-zero-survivors-not-a-score.md) (the
  zero is domain's), [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md)
  (the module stage measures the change too) and
  [ADR-022](022-a-module-tests-survivor-is-the-suites-to-answer.md) (a
  module survivor stands on a changed line, since no other line is mutated).
