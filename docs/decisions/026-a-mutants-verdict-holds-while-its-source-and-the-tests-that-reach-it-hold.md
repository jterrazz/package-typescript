# ADR-026: A mutant's verdict holds while its source and the tests that reach it hold

**Status:** Accepted
**Date:** 2026-10-15

The direction is the owner's, given 2026-10-13 ("Mutation speed", before
the vision 17 release): incremental reuse keyed per source file and the
tests that cover it, per-test coverage through the spawned CLI, module
tests for the lint's pure algorithms. The shape below is the one this
record proposes.

## Context

A cold `typescript mutation` of this package took about an hour (the
module stage nine minutes, the whole suite fifty), and every local
`make check` paid the suite stage in full, since `check` passed `--cold`.
`--cold` existed because the incremental report could not be trusted:
Stryker keys a mutant by the text around it and a test by its own lines,
so a kill a changed helper module, fixture or setup file had outlived was
kept. The guard against that was one hash of every fixture, golden and
setup file beside each report: any ground change dropped the whole
stage, and a change to a helper module was not seen at all.

A spec spawns the packed command, so until now the run could not say
which sources a spec's processes ran: any source change could move any
spec. And Vitest runs the slowest test file first, while Stryker stops a
mutant's run at the first test that detects it: a mutant a module test
kills in milliseconds waited on a spec that installs a whole project.

## Decision

- A stage's report is kept only for what the change since its run leaves
  standing. The run records the hash of every file git lists beside the
  report and, at the next start, takes out every mutant of a changed
  source, every kill a stale test made, and every other result a stale
  test covered, since Stryker stops at the first test that detects a mutant,
  so a kill stands while its killer does. A test is stale
  when its file changed, when ground under a folder above it changed,
  when a source its own process loads changed, and when a process it
  spawned ran a function of a changed source, or loaded it and the
  change reaches what loading the module does. A change to a file every
  test may read drops the report whole; a test the run could not follow
  into every process it spawned is stale on any source change.
- What a spawned process ran is read from V8's precise coverage, handed
  back by the reporter every spawned process already imports, and mapped
  through the source map of the sandbox's build to the sources it ran
  and loaded. Whether a change reaches what loading does is read from
  `git diff --no-index` against the text the last run kept and the
  module's syntax: a line of a function, a type, a comment or a blank
  does not; any other line does.
- `make check` runs `mutation` incremental; a run is cold when `--cold`
  or `TYPESCRIPT_MUTATION_COLD` asks, or when `CI` is set. `--cold` drops
  both stages' reports.
- A mutant's tests run quickest file first, by the time the last run took
  over each.
- The lint's pure algorithms (the comment rules, the names pass, the
  drift report's rows) are proved by module tests that compare their
  outcome whole, so the module stage kills what a spec killed in seconds.

## Consequences

- An incremental verdict is never greener than the cold one for what the
  run can see: a change in a covering test, its ground, a helper it
  imports or a source its processes ran measures its mutants again. The
  `typescript mutation` specs prove it on a packed consumer, and the old
  reuse fails the helper case. What no record can see stays a stated
  limit: a test that reads a file outside its own folder's ground, and a
  node process spawned with the reporter stripped from its environment.
- CI keeps the cold verdict, as the release criterion
  (`TYPESCRIPT_MUTATION_SINCE=<base> make check` run cold) does.
- Each stage keeps beside its report the record of its inputs and the
  text of every source it started on, under `.artifacts/stryker/`; the
  suite's dry run pays V8's coverage and the source maps' reading once.
- A change confined to a function body re-measures the specs that ran
  it, not every spec; a constant, an import or any statement run at load
  still re-measures every spec that loaded the build.
- Supersedes nothing; [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md)'s
  scope (the whole suite over a change) stands, and its cost is what
  this record cuts.
