# ADR-022: A module test's survivor is the suite's to answer

**Status:** Accepted
**Date:** 2026-10-08
**Accepted:** 2026-10-08: the owner's word on the pilots' list ("résoud tout les pbs qu'on a observé", "fais au mieux"), which named the reversal of ADR-020's order.
**Amends:** [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md): the order of its two runs.
**Amended by:** [ADR-029](029-a-mutant-is-made-where-it-can-teach-and-judged-by-what-its-code-is.md): a module survivor stands on a line the change reaches, since no other line is mutated.

## Context

[ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md) runs the
module tests first and starts the whole suite only once their verdict
passes: a mutant a module test runs and none detects fails the run before a
single spec is consulted.

The estate's doctrine proves behaviour end to end first and keeps a module
test for an algorithm a spec cannot reach cheaply. Under that doctrine a
module test often runs a line without judging it, because the line's judge
is a spec: a presenter whose output a command's spec compares whole, an
operation a served route's spec drives. The four pilots of vision 17
measured what the order costs. The studio-os workspace, measured for the
first time, left 934 module-test survivors before any spec could answer
(655 in its CLI, 166 in its connectors, 78 in its console), so its
`make check` could not carry the verdict at all; the gate was green by
leaving mutation out. Each survivor's fix under ADR-020 is an assertion in
a module test restating what a spec already proves, or a declaration that
the mutant is equivalent when it is not.

## Decision

- Every mutant a module test runs and lets live is handed to the whole
  suite, wherever it stands (on a changed line or not), beside what the
  module tests could not measure on the lines the change reaches.
- The run fails on a survivor only when the suite lets it live too: one the
  suite detects counts as detected, and the verdict says how many the suite
  answered that way. One the suite reports nothing of was judged by
  nothing, and fails the run.
- The suite starts whenever the module tests let a mutant live or the
  change reaches a line they leave. A module run that left mutants it never
  judged (a run stopped midway) still fails at once: nothing it reports
  can be handed on.

## Consequences

- A line is judged by the cheapest test that judges it: a module test where
  one does, a spec where only a spec does. No module test is written to
  restate a spec for the verdict's sake.
- A survivor costs a run of every test reaching it, minutes each where a
  spec spawns a built command, and the suite's dry run costs a build and a
  single-worker run of every node project whenever one survives. A project
  whose module tests leave none pays nothing more than before.
- A survivor no spec reaches either is reported as before, named at its
  line: the fix is still an assertion, or a declared equivalence.
- What each kind leaves to no run (a website's client code, a mobile app's
  screens) is stated per kind in `docs/reference/quality-checks.md`.
