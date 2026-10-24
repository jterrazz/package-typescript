# ADR-036: The suite stage starts Stryker only for the mutants its record does not carry

**Status:** Proposed
**Date:** 2026-10-24

## Context

The suite's dry run is 96 % of a suite stage: on this package, a warm gate
whose seven suite mutants the report already held paid a dry run of 195 test
files, 776.8 s, to run one mutant that ended a `CompileError` again in 0.3 s.
[ADR-030](030-the-suite-stage-pays-for-what-its-change-reaches-on-every-worker.md)
limits the dry run to the test files that reach the stage's sources, but
Stryker still needs it before it can reuse a result: it reuses a kill while
the killer still covers the mutant, any other result while no test it never
saw covers it now. A `CompileError` holds no covering test in the report, so
every test the dry run sees cover its line reads as new, and it runs again.
So any stage holding one compile error on a line the dry run reaches paid the
dry run on every gate, and a stage whose every result the report kept paid it
all the same.

The record of [ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md)
already says which results the change leaves standing, and the checker of
[ADR-032](032-the-mutant-checker-runs-on-the-native-compiler.md) answers a
mutant in milliseconds, with no test.

## Decision

- Before the suite starts Stryker, it reads which mutants of the stage the
  record carries, as Stryker would reuse them: each mutant the run makes,
  through the same ignorers, whose result the kept report holds for the same
  file, mutator, replacement and span, over the same text. A kill is
  carried. A survivor, a timeout, an uncovered or a static mutant is carried
  while no test of the record is stale and no test file is new, since only
  such a test can cover it now where none did. A `CompileError` is answered
  again by the checker the run hands Stryker, on the tree as it stands, and
  carried while the compiler still refuses it.
- Stryker runs only the sources holding a mutant it must judge. The others'
  results stay in the report it reads, which it keeps for every file outside
  its `mutate`. The dry run keeps the test files that reach a source Stryker
  runs, with the stale, new and unfollowed tests it always kept.
- Where every mutant is carried, Stryker does not start: no sandbox, no
  build, no dry run. The stage's report is the one the record carries, the
  run prints `dry run: none, the record carries the stage's N mutant(s)`,
  and the record, its report and its texts are left as the last
  run left them, so the next run reads the whole change since, and no test a
  change made stale is carried as if it had run.
- A run that writes the HTML report a person asked for always starts
  Stryker, which alone writes it. A cold run, and a run with no record,
  start it as before.
- The module stage is unchanged: its dry run is seconds, and what its tests
  ran (the mutants each test file ran beyond loading it) is read from a run.

## Consequences

- The verdict is the one Stryker reaches over the same report: a carried
  result is one Stryker reuses unrun, and a compile error is the checker's
  answer either way. The rule errs toward running: a timeout, a survivor or
  a static mutant runs whenever any test is stale, where Stryker would run
  it only if that test now covers it.
- A mutant the kept report holds that the run would no longer make over the
  same text stays in the report a skipped stage carries, where Stryker would
  drop it. The run makes another set over the same text only when its
  ignorers or Stryker itself change, and each is a file every test reads
  (the settings, the install), whose change drops the report whole.
- What the record cannot see stays ADR-026's stated limit, and a skipped
  stage adds no new one: the report it keeps is the one Stryker would have
  started from.
- A gate whose suite results all hold costs the planning (instrumenting the
  stage's sources, opening the compiler where a compile error is carried)
  instead of a sandbox, a build and a dry run.
- Measured on 2026-10-24, on a laptop other sessions loaded, the report and
  record of a cold run restored before each warm one, statuses compared
  mutant for mutant:

    | Project, scope                                                                                       | Warm before                                                                               | Warm after                                                  | Statuses                              |
    | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
    | this package, `--since 1b34204d`, 7 suite mutants (6 killed, 1 `CompileError`)                       | 876.9 s; suite stage 851.9 s, its dry run of 195 of 434 test files 831.2 s, 6 of 7 reused | 20.7, 22.0, 21.7 s; suite stage 1.2, 1.3, 1.1 s, no Stryker | identical, cold and warm, both stages |
    | package-test, two sources by `--mutate`, 21 suite mutants (10 killed, 10 `CompileError`, 1 survivor) | 520.6 s; dry run of 542 of 645 test files 477.6 s, 21 of 21 reused                        | 4.5, 3.2, 3.8 s; suite stage 2.4, 2.1, 2.1 s, no Stryker    | identical, cold and warm              |
