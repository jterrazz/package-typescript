# ADR-028: CI reuses what a restored report leaves standing

**Status:** Accepted
**Date:** 2026-10-19

The owner approved "Cheaper CI" item 4, CI reuses safe mutation results,
on 2026-10-18 ("faisons 2 3 4 5"); this record states the decision taken
within that approval.

## Context

[ADR-026](026-a-mutants-verdict-holds-while-its-source-and-the-tests-that-reach-it-hold.md)
made a mutant's verdict hold while its source and the tests that reach it
hold, and kept CI cold: a run where `CI` is set dropped every report,
whatever it held. So every push paid the cold module stage, about nine
minutes on this package, and the suite stage over the change, for a
verdict a laptop reached in seconds from its own report.

What ADR-026 keeps is keyed by bytes, not by a machine or a path: beside
each report the run records the hash of every file git lists and of the
install, and the next run takes out what the difference could have moved.
A report a runner restores from a cache, built on another commit or
another branch, meets that difference as a local report meets an edit:
each source, test or ground file whose bytes differ is changed, and a
changed lockfile, root config, setup file or install drops the report
whole. A runner gains nothing a laptop does not already trust.

## Decision

`CI` alone no longer makes a run cold. A run is cold when `--cold` or
`TYPESCRIPT_MUTATION_COLD` asks; otherwise it inherits what the change
since its report leaves standing, on a runner as on a laptop. A workflow
whose verdict must stand on no earlier run, a release's, sets
`TYPESCRIPT_MUTATION_COLD`.

This supersedes ADR-026 on two points only: its decision that a run is
cold "when `CI` is set", and its consequence that "CI keeps the cold
verdict". ADR-026 stays `Accepted`, and the line under its status marks
those two points superseded by this record.

## Consequences

- A push measures only what its change and the report its cache restored
  leave to measure; a release run asked cold still measures everything.
- The `typescript mutation` specs prove a run in CI reusing a report, and a
  report whose install changed since measuring every mutant again.
- What the record cannot see is what it could not see before, now on a
  runner too: the Node version is not among the hashed inputs, so a
  report restored under another Node patch keeps its kills. A workflow
  that changes its Node version asks the run cold.
