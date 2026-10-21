# ADR-034: A test run runs the test files its change reaches

**Status:** Accepted
**Date:** 2026-10-21

The owner accepted test selection by the diff on 2026-10-20, as the answer
to question 7 of the speed plan ("pas de difference entre le local et la CI
[...] juste basé sur des caches [...] ou la diff vs la branche"): no
separate `test-changed` gesture, `typescript test` itself selects, the
same way on every host, and runs everything where the record cannot tell.
This record states the decision taken within that approval.

## Context

`make test` runs the whole suite on every gate: on this package, 435 test
files, 155 s on an idle laptop and several minutes on a loaded one, where
a change of one source reaches a median of 6 % of the suite's spec time
([ADR-030](030-the-suite-stage-pays-for-what-its-change-reaches-on-every-worker.md)).
The green-verdict cache of
[ADR-033](033-a-green-verdict-holds-while-every-input-of-its-key-holds.md)
answers a tree it already proved, never a tree one file away from it.

The toolchain already knows which test reaches which source. The record
[ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md)
keeps beside the suite's mutation report names, per test, what its own
process imports (read from the sources' texts) and what the processes it
spawned ran and loaded (read from the dry run's coverage), and ADR-030
already limits the suite's dry run to the test files a change reaches by
it. Google's TAP selects the same way, by the dependency graph of a
change, and found 1.23 % of affected test executions breaking.

## Decision

- `typescript test` hands the project's `test` script the test files the
  change reaches, after `--` and with `--passWithNoTests`, and prints
  `ran K of N test files the change reaches` when it ends. When the change
  reaches none, nothing runs.
- The change is the union of two: the paths the working tree differs by
  from the commit the branch left the default branch at (the commit before
  HEAD on the default branch itself, uncommitted files included), and the
  paths that differ from the tree the record was taken on, so a commit
  made between the record and the base is never skipped.
- A test file runs when the record says a test it holds is made stale by
  that change, as ADR-026 judges staleness: its file changed, ground under
  a folder above it, a source its process imports, or one its spawned
  processes ran or loaded. A change of a source is read as reaching what
  only loads it, whatever lines it touches, since telling a change inside
  a function apart would load the compiler into every test run for a
  measured 0 to 8 % fewer files on this package. A test the dry run could
  not follow reaches every source, and a test file the record does not
  know (added since, a browser project's, one the mutation scope excludes)
  always runs.
- Every test file runs, the line saying why, where the record cannot tell:
  no suite record, a record naming no test, a change to a file every test
  reads (a root file, the lockfile, the install, a `__setup__/` file, a
  data file outside the ground folders), a source removed (its importers
  name a file the reach can no longer follow), a workspace root, a `test`
  script that is anything but one `vitest` command, and a base git cannot
  name. `--cold` runs every file too.
- One code path on every host: nothing reads `CI` or the event. What runs
  is decided by the record a host holds or restores, and by the diff
  against the base. The green-verdict cache still answers first; the key
  of a test proof holds the tree of the base it selected against.

## Consequences

- A test run is no longer a claim about the whole suite: it says that the
  tests the change reaches pass. A test whose reach the record cannot see
  (a file read by a path built at run time, a module loaded by a name no
  import spells) and that the change breaks is not run until a change the
  record does see reaches it, or a run where the record cannot tell. This
  is ADR-026's residual risk, now carried by the tests as well as by the
  mutants.
- The record is refreshed only when the suite's mutation stage runs. A
  project whose module tests answer every change keeps an older record,
  so the change since it grows, and more files run, until a suite stage
  records again; never fewer.
- Any change to a page of the manual, the lockfile or a root config runs
  every file, since such a file is read by code no import names.
- Measured on this package, on the record of the gate at `e147fee1`, one
  source changed: `src/commands/clean/clean.command.ts` reaches 60 of 435
  test files, `src/drivers/stryker/stryker.ts` 59, `src/commands/terminal.ts`
  262, `lint/kit/project/json.ts` 386, and one spec changed reaches itself
  and the files the record does not know; selecting takes about 0.6 s. The
  gain is smaller than the counts: the specs that run the packed tarball
  are ones the dry run cannot follow, so they reach every source, and they
  are the long poles. The 60 files of the `clean` change hold 700 of the
  suite's 1,085 file-seconds (65 %), and ran in 115 s against 132 s for
  every file, on a laptop other sessions loaded (load average 33 to 80).
  A change to a spec, a fixture or a module test alone runs a few files.
