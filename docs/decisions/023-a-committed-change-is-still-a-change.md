# ADR-023: A committed change is still a change

**Status:** Accepted
**Date:** 2026-10-08
**Accepted:** 2026-10-08: the owner's word on the pilots' list ("résoud tout les pbs qu'on a observé").
**Amended by:** the amendment below, for the clean-tree base.
**Amends:** [ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md), for the commit a run measures from when none is named.

## Context

[ADR-020](020-mutation-measures-the-whole-suite-over-a-change.md) measures
the change as the working tree against `HEAD` unless `--since` or
`TYPESCRIPT_MUTATION_SINCE` names another commit. CI names one; a local
`make check` does not. On a branch whose work is committed, the working
tree equals `HEAD`: the suite measured nothing, the verdict read
"0 detected", and the gate passed. The package-telemetry pilot of vision 17
read green that way while its spec-proven sources held 209 mutants; a wave
of repositories migrated on local branches would have read every one of
them green unmeasured.

## Decision

- With no commit named, a run measures the change not yet committed,
  against `HEAD`, as before. Where the working tree is clean, it measures
  the last commit, against the commit before `HEAD`: a gate run after the
  commit measures the commit it follows. `HEAD` alone is the base only for
  a repository's first commit.
- The run prints the commit it measured against, and says so when nothing
  changed since it, naming `--since` to measure a wider change.
- The merge-base with the default branch was weighed and set aside: on a
  long local branch (vision 17's package-typescript holds 682 commits and
  29,000 changed lines over main), it hands the suite the whole branch on
  every gate, days of mutants, where one commit at a time is what a commit
  by unit of meaning brings.

## Consequences

- A gate run before each commit measures that commit's change; one run
  after it measures the same change again, now committed. A branch of
  several commits checked only at its end measures its last commit; its
  whole change is measured by naming its base with `--since`, as CI names
  the commit a push or a pull request started from.
- A clean clone's gate measures its last commit, never nothing in silence.

## Amendment (2026-10-10): a clean branch is measured since its merge-base

**Accepted:** 2026-10-10: the architect's decision of round 1 of the convergence loop, on the wave's seven repositories.

The last commit was not enough. A branch whose last commit changes docs
read "0 detected", green, while the commits before it held sources no gate
had measured (studio-design, package-manifest, hoverfly-lsp, package-analytics,
studio-workstation, jterrazz-web). The clean-tree base is now the merge-base with
the default branch: `merge-base..HEAD` for a branch that holds commits of its
own, the last commit only on the default branch. The default branch is
`origin/HEAD`'s, else `main`, else `master`.

The verdict prints its scope, `measured 137 mutants over 56df803..HEAD`, and a
run that mutated nothing says `measured nothing over <range>: <why>` where it
used to print `every mutant a test runs is detected — 0 detected`. The cost the
first decision weighed (a long branch hands the suite its whole change on one
gate) is accepted: the incremental report keeps the next run to what changed,
and a gate that measured one commit of 682 was the false green. A Makefile
needs no `--since` to be honest any more.
