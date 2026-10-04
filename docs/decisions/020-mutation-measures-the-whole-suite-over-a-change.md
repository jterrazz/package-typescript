# ADR-020: Mutation measures the whole suite over a change

**Status:** Proposed
**Date:** 2026-10-04

## Context

[ADR-019](019-mutation-judges-zero-survivors-not-a-score.md) left two kinds of
code with no mutation measure, and asked the owner's word on them. Code only
the specs prove: 351 mutants no module test runs in this package, 832 in
`@jterrazz/test`, 43 in signews-api, besides every source with no module test
at all. And static mutants — code that runs as a module loads, a table, a
pattern, a function's definition — which Stryker either reruns against every
test or skips under `ignoreStatic`: 600 skipped here, and in `@jterrazz/test`
648 that also ran when a test called them, judged by a run that activated the
mutant only after the module had loaded, so that their survival said nothing.

The specs spawn the built command. A run of the whole suite therefore needs
three things a run of the module tests does not: an instrumented build, the
active mutant handed to every spawned process, and each process's coverage
handed back, or Stryker sees no test reach the code and runs every test
against every mutant. Even with all three, a mutant costs a run of every test
that reaches it, and the specs of a command reach most of its code: over the
whole tree of this package the suite ran six mutants in eleven minutes, and
Stryker estimated sixty hours for the 11,200 the module tests left.

## Decision

- `typescript mutation` is two runs and one verdict, every mutant a test runs
  detected. The module tests run against the sources they test; the whole
  suite then runs against what they could not measure, on the lines the
  change touched — the working tree against `HEAD`, or against `--since` /
  `TYPESCRIPT_MUTATION_SINCE`, which the shared validate workflow sets to the
  commit a push or a pull request started from.
- Every process a test spawns imports a reporter first. The parent hands it
  the active mutant; it hands back, on exit, the mutants it ran, which the
  parent credits to the test that spawned it.
- A mutant activates before the test file loads, so module-level code runs
  mutated. A static mutant is credited to every test of each file whose
  loading ran it, and runs against those tests alone. One they detect is
  detected; one they let live is left to the suite, since loading a module
  says nothing of whether a test reads what it defines.
- A mutant the module tests left on a line no change has reached is counted,
  in one number, until a change brings it to the suite. `--mutate` points both
  runs at named lines, changed or not.

## Consequences

- Spec-proven code is measured where it changes: no change lands with a line
  the suite runs and lets change unseen. The code no change has touched since
  is counted, not judged, and the count says how much.
- A change to code the specs reach everywhere costs, per surviving mutant, a
  run of every test reaching it — minutes each; the suite's dry run costs a
  build and a single-worker run of every node project, about five minutes
  here, whenever a change reaches a line the module tests leave.
- A test that cannot run against instrumented code — one reading the sources
  as text, one type-checking the built declarations — is excluded by
  `typescript.mutation.exclude`, with its reason.
- A mutant an instrumented build cannot bundle (an empty import specifier) is
  declared where it stands: it can reach no test.
- Measured when the decision was taken: every static mutant now runs. Here,
  where Stryker skipped 515, the module tests kill 586 static mutants and
  leave 231 to the suite; in `@jterrazz/test`, 2,032 killed and 1,196 left,
  where 648 had been judged with the mutant activated after their module
  loaded. A first module run of `@jterrazz/test` takes 80 minutes, an
  incremental one seconds; the suite's dry run here, four and a half.
