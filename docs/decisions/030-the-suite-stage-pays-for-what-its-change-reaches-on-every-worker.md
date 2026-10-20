# ADR-030: The suite stage pays for what its change reaches, on every worker

**Status:** Accepted
**Date:** 2026-10-20

The owner accepted the plan on 2026-10-20 ("tout ok"): the three levers
below, the lesson and message files declared presentation, the lazy loading
of commands measured before any convention, and the slowest spec files
split only where they set the dry run's floor. Measured, the lazy loading
was adopted on 2026-10-20 ("faire toutes les optis").

## Context

After [ADR-029](029-a-mutant-is-made-where-it-can-teach-and-judged-by-what-its-code-is.md),
a branch's whole check here took 36 minutes for 550 mutants, and the suite
stage held 1,553 s of it. Half of that was the dry run: one run of the whole
suite on one Vitest worker, 808.5 s, where `make test` runs the same suite
in 155 s. Stryker's Vitest runner sets one worker for every run, the dry
run's included. The other half was the mutants, and a module-level mutant
of what a command loads is credited to every spec that spawned the command
([ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md)): 140 to
190 spec files each, run quickest first, while the spec that ran its code is
the one that detects it.

The record [ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md)
keeps already says, per test, which sources its processes loaded and which
functions they ran. Measured over this package's record, a one-file change
reaches a median of 6 % of the suite's spec time, and the dry run ran all of
it.

## Decision

- The suite's dry run runs its test files on as many Vitest workers as the
  stage has test runners. It activates no mutant, and Stryker reads its
  coverage file by file; each mutant's tests still run on one worker.
- A mutant's tests run the files whose processes ran a function of its
  source first (with a test that spawned nothing, and one the dry run could
  not follow), then the files that only loaded it, each group quickest
  first. The order moves no verdict, only the time to the first kill.
- The suite's dry run runs only the test files the record says can reach the
  stage's mutants: a test the change made stale, one whose process loads a
  mutated source, one whose spawned processes ran a function of it or
  loaded it while a mutated line sits outside every function, one the
  record cannot follow, and a file added since. Every file runs with no
  record, on a cold run, and where the change reaches a file every test
  reads. The record carries the tests a dry run left out, unchanged, and
  names each test it could not follow, so the next run still knows its file.
- What the suite's dry run will run is printed before it starts:
  `dry run: 41 of 365 test files the change reaches, on 7 worker(s)`.
- A `cli` loads each command when it dispatches to it, one `import()` per
  entry of its table of commands, this package's `src/commands/main.ts`
  first. A spawned command then loads its own modules alone, so a mutant
  of what one command loads is credited to the specs that run that command,
  not to every spec that spawns the binary. It is the `cli` kind's
  convention, stated in [Configuration](../reference/configuration.md#kind-and-platform).
- The files that hold only the messages a refusal prints are declared
  presentation, amending ADR-029's "lesson prose stays mutated": a golden
  compares each whole. The lessons a rule or a pass teaches stay mutated,
  since they sit in the files that hold its logic, which stay domain.

## Consequences

- The verdict of a run is the one a one-worker, whole-suite dry run gives:
  the coverage is the same file by file, and a file left out holds no test
  that could reach a mutant of the stage by the record that already keeps a
  verdict standing. A wrong record (a test that reaches a source by a path
  the record cannot see, as ADR-026 states its limits) now also narrows a
  dry run.
