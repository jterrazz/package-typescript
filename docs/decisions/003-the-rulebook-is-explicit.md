# ADR-003: The rulebook is explicit — every rule decided, no categories

**Status:** Proposed
**Date:** 2026-09-15

## Context

Until v9 the lint configuration was four boolean switches. Of the 305 rules a
project actually ran, 36 were written by hand and the other 269 arrived from
`categories: { correctness, suspicious, perf, style }`. Three consequences were
measured before this decision.

Flipping one switch moved about 124 rules at once, which is why
`react/rules-of-hooks` was off in every React application of the estate: it
lives in `pedantic`, and `pedantic` was off for unrelated reasons.

Nothing recorded the effective set, so an oxlint bump could add or remove dozens
of rules with every test still green.

And a category arms rules of plugins the config never names. They are inert
until a framework config activates the plugin, and then they fire unannounced —
the regression Ultracite hit (#660) and now has a test forbidding.

## Decision

`rules/` is a manifest: one fragment per plugin, every non-nursery rule of that
plugin decided by name, at `error` or at `off`. `categories` appears in no
config this package ships, and a test refuses one. There is no `warn` tier.

An `off` carries exactly one of five recorded reasons — it fights the formatter,
it is exclusive with a rule that is on, it refuses a named estate convention, it
has a cited false-positive measurement, or a stronger named rule already covers
the defect. "Too strict" is not a reason. `rules/_contract.js` refuses a
fragment that breaks either invariant at load time.

Nursery is off wholesale, because upstream declares it unstable.

## Consequences

- The decision count is the work: 535 core rules, plus 88 React, 36
  accessibility, 21 Next and 73 vitest rules for the profiles that load them.
- An oxlint release that adds a rule turns `rule-surface.test.ts` red until
  somebody decides it. That is the cost, and it is the point.
- `resolved-config.test.ts` makes a flipped rule one line of a reviewable diff.
- The manifest carries `since` per decision, which is what replaces the
  changelog this repository does not keep.
- A consumer's config names a PROFILE, not a set of fragments. That changes the
  shape of every consumer's `oxlint.config.ts`, which is what makes this v10.
