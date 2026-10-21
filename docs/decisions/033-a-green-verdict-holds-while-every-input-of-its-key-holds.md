# ADR-033: A green verdict holds while every input of its key holds

**Status:** Accepted
**Date:** 2026-10-21

The owner accepted the green-verdict cache and the CI tree dedupe as one
mechanism on 2026-10-20 ("pas de difference entre le local et la CI [...]
juste basé sur des caches [...] ou la diff vs la branche"); this record
states the decision taken within that approval.

## Context

A gate run on a tree it already proved green proves nothing new, and pays
for it in full. On this package `make check` takes tens of minutes, most of
them in its tests and its mutation stage. The same tree is gated again and
again: an agent re-running a green gate, a rebase that moves no file, a
release whose commit the push before it already validated. In
package-test, the push to `main` and the pull request before it shared one
tree in 6 of 6 sampled pairs, and seven releases of this package
validated a commit whose push validate was already green.

Go's test cache, Bazel, Turbo and Nx answer the same waste with one idea: a
result is keyed by the content of everything that can change it, a hit
replays it, and a failure is never kept. The toolchain already trusts that
idea where it is keyed on content: tsc's buildinfo, and the mutation
record of [ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md),
which [ADR-028](028-ci-reuses-what-a-restored-report-leaves-standing.md)
lets a runner reuse through its restored `.artifacts/`. Knip runs uncached
because its cache is keyed on mtimes, which can lie.

The owner's rule for every speed chunk is one code path on every host:
what varies is only what the cache holds and the diff against the base
branch, never a mode chosen by which machine runs.

## Decision

Each stage of the gate keeps its green as a proof keyed by the content of
its inputs, and answers the same key from it: `typescript check`,
`typescript mutation`, and `typescript test`, a new command that runs the
project's own `test` script, so the tests a `Makefile` runs are cached on
the same terms as the two stages the toolchain already ran. CI runs the
stages as separate steps (`make lint`, `make test`, `make mutation`), so
the proof lives per stage, not per `make check`.

The key holds:

- the tree: the tree the index holds and the tree of every file git does
  not ignore, tracked or not, both written by `git write-tree` from a copy
  of the index, so a file's bytes, its presence and whether git tracks it
  each change the key;
- the lockfile and the install npm or pnpm records beside the dependencies;
- the toolchain that runs, by its version and the hash of every file of
  its `dist/`;
- Node's version, the platform and the architecture;
- the Chromium builds the project's Playwright launches, and whether the
  machine holds each;
- a closed list of variables that change what a stage decides: `CI`,
  `GITHUB_ACTIONS`, `NODE_ENV`, `NODE_OPTIONS`, `PLAYWRIGHT_BROWSERS_PATH`,
  `TEST_UPDATE` and `TZ`;
- the stage, its arguments, and what else it reads: the passes `check`
  selected, and for `mutation` the tree of the commit it measures against,
  so the change it measures is keyed by content whatever names its base.

`TYPESCRIPT_CAPACITY` and `TYPESCRIPT_GATE` are outside the key: they size
and hold a run, and never change its verdict.

A red is never kept. The key is taken before the run and again after it,
and a green is kept only when both agree, so a run that rewrote its own
tree (a golden `TEST_UPDATE=1` rewrote) proves nothing. Outside a
repository nothing is proven. `--cold` runs the stage whatever proof it
holds, and keeps the green it ends on; `check --json` always runs, since a
proof keeps the verdict and not the drift report.

The proofs live in `.artifacts/proven/`, eight per stage, so whatever
carries `.artifacts/` between runs carries them, on every host by the same
code. A release reads the same proofs: a run is cold only where nothing
proved its key.

## Consequences

- A second gate of a proven tree costs the build and one hit per stage, on
  a laptop and on a runner whose cache restored a proof for that key.
- A runner reuses a proof only when its cache restores the `.artifacts/`
  that holds it and every other input agrees, its Node and its
  environment included. A proof a laptop left never answers a runner: the
  platform and `CI` differ.
- The residual risk is what the key cannot see: a container image a spec
  pulls by a tag the registry re-points, the network, a service outside
  the checkout, an installed dependency edited in place, and a variable
  outside the list. A project closes the first by pinning its images by
  digest in the tree; a run that doubts the others asks `--cold`.
- A project's `Makefile` runs its tests through `typescript test` to have
  them cached; one that keeps `npm test` keeps running them every time.
- Per-pass keys (a lint pass keyed on its sources and config alone) are a
  later refinement this record does not take: a stage's proof holds its
  whole tree.
