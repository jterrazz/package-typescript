# ADR-030: The suite stage pays for what its change reaches, on every worker

**Status:** Accepted
**Date:** 2026-10-20
**Superseded in part by:** [ADR-031](031-every-pool-is-sized-from-one-leased-capacity.md), for the workers being "the capacity the host detects, or `TYPESCRIPT_JOBS`": one leased capacity model sizes them, and `TYPESCRIPT_CAPACITY` gives a gate its capacity.

The owner accepted the plan on 2026-10-20 ("tout ok"): the three levers
below, the lesson and message files declared presentation, the lazy loading
of commands measured before any convention, and the slowest spec files
split only where they set the dry run's floor. Measured, the lazy loading
was adopted on 2026-10-20 ("faire toutes les optis"), under the owner's
rule of the same day that the toolchain takes one code path on every host.

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
- One code path on every host: nothing reads `CI`, `GITHUB_ACTIONS` or the
  event that started a run. The workers are the capacity the host detects,
  or `TYPESCRIPT_JOBS`; the files a dry run runs are the record's and the
  diff's. A host that restores no record runs every file, and one that
  restores no report runs cold, by that alone. `TYPESCRIPT_MUTATION_COLD`
  is gone with it, amending ADR-028: a release whose cache restores a report
  inherits what its change leaves standing, as every run does, and
  `--cold` is the one way to ask a cold run.
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
  the coverage is the same test by test, and a file left out holds no test
  that could reach a mutant of the stage by the record that already keeps a
  verdict standing. A wrong record (a test that reaches a source by a path
  the record cannot see, as ADR-026 states its limits) now also narrows a
  dry run.
- Nested runs are not exactly reproducible. Over the same 2,178-mutant plan,
  the observed records and the tests each source ran were identical on 1 and
  on 4 workers, but 11 module-level mutants of
  `lint/kit/catalogue/decisions.ts` gained 25 covering pairs on 4 workers,
  and two 4-worker runs differed from each other by 4 of them. No mutant
  lost a test or changed between covered and uncovered. It is read as the
  timing of what the grandchildren of a nested Stryker run hand back, not
  as a fault of the per-file merge, and accepted: a drifting mutant runs
  one test more, never one less.
- Measured on this package, on a laptop shared with other gates (the
  load of the machine moves every figure by tens of percent):

    | What                                                                          | Before                                                    | After                                                                           |
    | ----------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
    | the suite's dry run over one plan of 2,178 mutants                            | 883.9 s on 1 worker                                       | 298.4 s on 4 workers                                                            |
    | a one-file loop, `--mutate src/commands/clean/clean.command.ts:11-16`, 2 jobs | 1,014 s: a dry run of every file, 880.4 s, then 9 mutants | 303 s: a dry run of 56 of 409 test files, 280.3 s, on 2 workers, then 6 mutants |
    | test files covering a module-level mutant, the plan's 291                     | 179.1 on average, median 227                              | 37.1, median 15, commands loaded on dispatch                                    |
    | a branch gate's suite stage, 2 jobs, a fresh clone with no record             | 1,552.8 s: dry run 808.5 s, 145 mutants 731.5 s           | 2,073.9 s: dry run 421.6 s on 2 workers, 223 mutants 1,635.6 s                  |

    The last row is no like-for-like: the branch after measures its own
    change too, 223 suite mutants against 145, most of them in the code
    that drives Stryker, which the slowest specs cover. Its dry run halved
    with the workers alone, since a fresh clone restores no record and runs
    every file; a warm host runs the files the change reaches, as the loop
    does.

- Added and accepted by the owner on 2026-10-20 ("fais l'ensemble des
  trucs remontés"): a process a mutant's tests spawn compiles through
  Node's compile cache, which the `typescript` bin turns on before it loads
  the command, and a process the dry run spawns does not
  (`NODE_DISABLE_COMPILE_CACHE`): V8 serialises a cached script without the
  source positions the dry run's precise coverage reads, and a reach the
  record missed would leave a verdict standing that should run again.
  `typescript doctor` runs in 170 ms against 194 ms, median of 24 starts.
- Added and accepted by the owner on 2026-10-20 ("fais l'ensemble des
  trucs remontés"): ahead of both groups runs the test file that killed
  the mutant in the stage's last report, as PIT runs the last killing test
  first since 1.14.4. A mutant is the last report's when its file, its
  mutator, its replacement and the code it replaces match, so one whose
  source changed around it still finds its killer. The order still moves
  no verdict.
