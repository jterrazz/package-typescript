# ADR-019: Mutation judges zero survivors, not a score

**Status:** Accepted
**Date:** 2026-10-04
**Amended by:** [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md) — what the verdict reaches: the whole suite over a change, and the module-level code a module test loads.

Written 2026-10-04 from commits 7e2c711f and 0654950b, which took the
decision on 2026-10-03, and from the reading of the specs' mutants that
`docs/guides/test.md` carried until then.

## Context

The owner's decision of 2026-10-02 asked for mutation persisted with "a
score ratchet in the debt ledger": `typescript mutation` held a score to a
floor in `.jterrazz/baseline.json` that could only rise.

The score was a number over every mutant, the ones no module test runs
included. On this package it read 22%, and most of the mutants behind it
sat in sources only the specs prove: the default run never reaches them,
since the specs spawn the built command and no mutant of the sandbox is in
it. A floor over that number rewarded any test that ran more lines, and
said nothing of whether a line a test runs is a line it judges.

The specs themselves were measured once, in October 2026, on the
instrumented build, each mutant driven through its own `vitest run` with
the active mutant handed to every process the specs spawn: the suite killed
2,929 of 10,251 mutants, against 2,932 before the module tests that restated
a spec were deleted. No committed tool reproduces that reading — a run of
that size takes hours — and `--specs --mutate <ranges>` is what measures
the specs now, by hand.

## Decision

- The default run mutates only the sources that carry a module test beside
  them, and its verdict is zero: a mutant a module test runs and none
  detects fails the run, unless a `// Stryker disable` above its line states
  why it is equivalent. Nothing is recorded; the mutation section of the
  ledger is gone.
- A mutant no module test runs is counted, file by file, and never judged.
  A static mutant is skipped. Code only the specs prove therefore has no
  automated mutation measure: `--specs` measures it by range, run by hand.
- The verdict runs incrementally inside each repository's `make check`, and
  in the shared validate workflow on every push. The weekly job the
  decision asked for is not kept: it reran what every push now runs.
- With mutation and coverage, the two measures that only rose, gone from
  the ledger, a section of it can no longer be a floor: the kit keeps one
  judge, exact debt ([ADR-016](016-one-engine-writes-every-rule.md) is
  amended).

## Consequences

- The verdict is binary and local: a survivor is named at its line, and the
  fix is an assertion or a declared equivalence, never a number to chase.
- The doctrine measures a suite's value by mutation, and most of this
  package is proven by its specs: that part of the suite has no gate. The
  owner's word is asked on it — a scheduled `--specs` run over chosen
  ranges, a NoCoverage line in a module-tested file made a failure, or the
  gap accepted as written in `docs/reference/quality-checks.md#what-no-verdict-measures`.
- A module-level table is never mutation-judged by the default run; the
  tests that read it are its only proof.
