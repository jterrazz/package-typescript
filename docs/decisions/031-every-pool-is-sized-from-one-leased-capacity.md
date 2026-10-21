# ADR-031: Every pool is sized from one leased capacity

**Status:** Accepted
**Date:** 2026-10-20
**Superseded in part by:** [ADR-032](032-the-mutant-checker-runs-on-the-native-compiler.md), for the checker's seed price: the checker holds the native compiler, measured at 720 MB.

The owner accepted the plan on 2026-10-20 ("fais l'ensemble des trucs
remontés"), under the rule of the same day that the toolchain takes one code
path on every host.

## Context

Five pools sized themselves to every core and none read memory: Vitest's
workers, Stryker's test runners, and the native tools under them. On a
16 GB laptop the memory binds first, so every gate an agent ran was pinned
by hand to `TYPESCRIPT_JOBS=2`, which left eight of ten cores idle on a
quiet machine and still swapped on a busy one. The count of gates on the
machine was read once, when a run started, so the first gate kept its whole
share when a second one began. A gate a spec started inside a test runner
sized itself to the whole machine again. With the TypeScript checker on,
Stryker 10 holds half of its processes as checkers until checking ends, so
two jobs meant one test runner. No log said what a run ran on.

The workers measured differ by twenty times: a Vitest fork running an empty
test holds 27 MB, a test runner of this package's whole suite 400 to 520 MB
with what its specs spawn. One count per core cannot fit both.

## Decision

- One model, in the kit (`lint/kit/project/capacity.ts`), sizes every pool
  of a gate: `max(1, min(cpus, floor(memory / price)))`, each pool with its
  price per worker.
- The machine is read, never assumed from the host's name: the cpus Node
  counts (a container's quota included), the least of the memory installed
  and a container's limit, and the memory the system says nothing holds now.
  A gate plans on what is available less an eighth of the machine. Nothing
  reads `CI`, `GITHUB_ACTIONS` or the event that started a run.
- The prices start from seeds (a Vitest worker 600 MB, a module-test runner
  650 MB, a whole-suite runner 1 GB, a checker 400 MB) and are learned: a
  stage samples the memory its processes hold, and records the peak per
  test runner in `.artifacts/capacity.json`. A pool's price is the highest of
  its last five peaks.
- The checker is priced apart. Stryker 10 takes one concurrency and splits
  it into checkers and runners while checking, then turns the checkers into
  runners (`concurrency-token-provider.js`); no option sets the checkers
  apart, so the count is the most that fits both phases, each phase priced
  by what it holds.
- The gates of a machine lease it. An outermost gate takes a lease under the
  system's temp folder (`typescript-capacity/`) while it runs, and every
  stage reads the leases again before it sizes: the live gates share the
  cpus by age so the shares add up to the machine, and the memory in
  proportion. A nested gate leases nothing.
- `TYPESCRIPT_CAPACITY` (`cpus=4,memory=8g`, either part alone) gives a gate
  its capacity whole, and replaces `TYPESCRIPT_JOBS`, which is gone with no
  alias. The same variable hands each test runner its share while Stryker
  runs, so a gate a spec starts sizes itself to its runner's slice.
- The suite's dry run runs on as many Vitest workers as the stage has test
  runners, as [ADR-030](030-the-suite-stage-pays-for-what-its-change-reaches-on-every-worker.md)
  decided; the model now sizes that count.
- Each stage prints the capacity it sized by:
  `capacity: 10 cpus, 16.0 GB, 6.4 GB available, 2 gate(s): this gate 5 cpus, 4.4 GB · 5 test runner(s) at 500 MB, 3 checker(s) at 400 MB while checking: cpus bind`.
- `slotsFor(project, pool)` on `./rules` hands the same model to a sibling
  package, so `@jterrazz/test`'s preset can size Vitest's workers by it, and
  `priceLearned(project, pool, peak)` beside it records the peak per worker
  that package measures, so it learns the price without owning the format of
  `.artifacts/capacity.json`.

## Consequences

- An agent no longer pins a count: a gate on a quiet machine takes it, and
  two gates overlapping take complementary shares from their next stage on.
- A price measured on a small run can be short for a large one: the reserve
  of an eighth and the highest of five peaks absorb it, and an
  out-of-memory kill would name the price to raise. The peak is resident
  memory, which counts shared pages more than once, so a learned price errs
  high.
- A lease is seen only by the gates that share its temp folder: a container
  or a virtual machine on the same host sizes itself to what it is given, not
  to the host's other gates.
- The checker still holds half of a stage's processes while it checks; only
  a release of Stryker with a separate checker count would let the runners
  take the whole slice from the first mutant.
- Vitest under `make test` keeps its own count of workers until
  `@jterrazz/test`'s preset reads `slotsFor`, and a gate one of its specs
  starts outside any other gate reads the machine whole.
- Measured on this package, on a 10-core, 16 GB laptop that other
  sessions also loaded, each gate a fresh clone of its branch with no
  override and no `.artifacts/` (so every price was its seed):

    | What                                | Before: 2 jobs                          | After: the model                        |
    | ----------------------------------- | --------------------------------------- | --------------------------------------- |
    | the whole `make check`, `npm ci` in | 2,465 s                                 | 1,431 s                                 |
    | the module tests                    | 456.1 s on 2 runners                    | 239.8 s on 10 runners, the cpus binding |
    | the whole suite                     | 1,844.4 s on 2 runners, dry run 582.6 s | 993.6 s on 10 runners, dry run 252.6 s  |
    | mutants judged                      | 697, over the branch of ADR-030         | 972, over that branch and this one      |
    | swap used, every 30 s               | not sampled                             | 5.4 GB at the start, 7.4 GB at the peak |

    The two rows of mutants are no like-for-like: the branch after carries
    ADR-030's change and this one, most of it in the code that drives
    Stryker, which the slowest specs cover. The swap peak came in the
    suite's mutant phase, ten runners priced at the 500 MB seed, and the
    run learned 1,017 MB per suite runner for the next one. Gates of a
    worktree that had learned 822 and 881 MB ran their incremental suite on
    8 and 7 runners, the memory binding, in 493 s and 481 s; the one
    sampled raised swap by 1.1 GB.

- The first seeds, 300 MB a module-test runner and 500 MB a whole-suite
  runner, were short: the gates above learned 578 to 662 MB and 862 to
  1,017 MB, and a first run on a fresh host swapped to 7.4 GB on them. The
  seeds were raised to what was learned, on 2026-10-20, so a host with no
  `.artifacts/capacity.json` does not oversubscribe its first run. The owner
  accepted the raise the same day ("fais l'ensemble des trucs remontés").
- The Vitest seed, 150 MB, was short: `@jterrazz/test`'s own suite measured
  592 MB per worker with the processes its specs spawn, on 2026-10-21. It
  was raised to 600 MB the same day, under the owner's word on the review
  ("Tout ok").
