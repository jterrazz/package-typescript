# ADR-035: A pool is priced by the high of its run, and its tool once

**Status:** Proposed
**Date:** 2026-10-24

Amends [ADR-031](031-every-pool-is-sized-from-one-leased-capacity.md):
how a price is learned, what a pool is charged for its tool, and which
run teaches Vitest's price.

## Context

ADR-031 priced a pool from the most memory a run held at one sample,
divided by its workers. One sample is two seconds, and a spec of this
package starts gates, builds and checks that hold gigabytes for a few of
them: a suite stage sampled steady at 0.5 to 1.4 GB per run spiked once
to 4.2 GB, so it learned 2.0 GB per runner, and its next gate ran on one
runner and took 776.8 s for the dry run that took 465.7 s on the two the
seed priced. Its next five runs priced 970 to 2,116 MB.

Stryker's own process was left out of every sample and charged nowhere,
held by the reserve of an eighth. Vitest's price was never learned at
all: `@jterrazz/test`'s preset sized the workers from the 600 MB seed,
and nothing measured a Vitest run.

## Decision

- A run's samples teach their ninth decile, by nearest rank, not their
  most: a spike a few samples long is no price every worker pays for the
  whole run, and the reserve of an eighth absorbs it.
- A pool has a tool, the process that runs its workers, held once
  whatever their count: Stryker's own process for a stage, Vitest's with
  the npm that starts it for a test run. A slice holds
  `max(1, min(cpus, floor((memory - tool) / price)))` workers. Each
  sample splits the tool from what is below it; the tool's decile is
  recorded as it is, the rest shared by the workers.
- The seeds: Stryker 300 MB and Vitest 300 MB, near the 57 to 187 MB
  and 212 to 235 MB their ninth deciles measured; a Vitest worker keeps
  600 MB, the runners and the checker theirs.
- `typescript test` sizes Vitest's workers and hands them to a script
  that is one `vitest` command (`--maxWorkers`), unless it states its
  own, and a run of every test file teaches the pool its cost; a run of
  a few files leaves workers idle and teaches nothing.
- The file is `.artifacts/costs.json`, so no peak learned the old way
  prices a run.
- What the machine is read as stays ADR-031's: the memory the system
  says nothing holds, less an eighth.

## Consequences

- A suite stage whose specs start gates prices its runners by what they
  hold most of the run, so a spike no longer halves the next gate. Over
  the samples of the three gates that ratcheted on 2026-10-24 (an outside
  `ps` every 2 s, both stages, no process left out), the most and the
  ninth decile below Stryker were 4,140 and 1,382 MB (two
  runners), 3,416 and 827 MB (one), 2,555 and 971 MB (two): a runner
  priced 2,070, 3,416 and 1,278 MB by the most is 691, 827 and 486 MB by
  the decile.
- A run above its ninth decile for one sample in ten is sized by the
  lower; the reserve of an eighth, not the price, carries the spike.
- What one worker holds falls as workers are added, since their highs do
  not coincide: `@jterrazz/test`'s suite measured 737, 805 and 660 MB a
  worker on one worker, about 590 on three, 440 on four and 350 to 400 on nine
  (ninth decile of the tree less Vitest). A cost learned on few workers
  errs high, so a host short of memory starts few and learns its way up
  as runs on more workers follow, never the other way.
- On a laptop that other sessions load, where the system says 2.5 to
  4.5 GB is available, the run takes one to three workers; it is the
  reading of the machine that binds, not the price. Swap grew by about
  2 GB during every run of that suite, on one worker as on four, so
  nothing measured says the reading is too cautious.
