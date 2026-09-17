# ADR-006: A ratchet, not a big bang

**Status:** Accepted
**Date:** 2026-09-15

Written at decision time, as part of v10 — the release that turns type-aware
linting on and takes the rule count from roughly three hundred decided rules
to every rule of every loaded plugin.

## Context

v10 makes the rulebook strictly stronger, and twenty-eight repositories
consume it through a caret range. The audit measured what that means in
practice: one repository turns twenty-nine rules off, another is pinned to a
linter version two dozen releases behind its own config, and the type-aware
rules — fifty-nine of them — were configured and never ran at all. A bump
that demands a clean tree before it can be green is a bump nobody takes.

Three shapes were available.

- **A warn-only tier.** A rule that only warns is a rule nobody fixes, and
  the estate has already decided it has no warn level: `warn` does not exist
  in any config this package ships.
- **A big bang per repository.** Burn every diagnostic down in the adoption
  pull request. Honest, and it makes the adoption of a fifty-rule release a
  multi-week task held by one person — which is how a fleet ends up pinned.
- **A ratchet.** Record what a repository owes on the day it adopts, and
  refuse any count going up from there.

## Decision

`oxlint.baseline.json`, tracked at the project root, holding `{ "<rule>":
<count> }`. Where the file exists, the oxlint pass is judged by it instead of
by oxlint's exit code; where it does not, one diagnostic fails, as before.

Three things fail a run that has a baseline: a count above its entry, a rule
with diagnostics and no entry, and an entry whose count has reached zero. The
third is what makes the file a ratchet rather than an amnesty — it can only
shrink, and reaching zero on a rule is an event the gate announces.

`typescript baseline` writes it. It is a command of its own rather than a
flag on `fix`, because recording debt is neither checking nor repairing, and
burying a rewrite of a tracked file inside the gesture a developer runs
twenty times a day would make the ratchet slip by accident.

This package records none of its own: the seven diagnostics type-aware
linting found in its source were fixed inside the release, and an entry at
zero is an entry the third rule above removes.

## Consequences

- A repository adopts a stricter release on the day it ships, and burns its
  debt down on its own clock. The bump is never the blocker.
- The debt is VISIBLE: it is a tracked file, it appears in review, and the
  drift report prints its total on every run.
- A baseline can be abused — a team can record everything and never burn it
  down. Nothing here prevents that, and nothing should: the drift report is
  what makes it legible, and legibility is the mechanism.
- A stricter rule stays a MINOR version. The consumer is not required to
  change how it consumes the package; it is required to record where it
  stands, which is one command.
- The file is a second place a rule name appears, so a rule renamed upstream
  turns its entry into new debt plus a stale entry at zero. Both are reported
  in the same run, and `typescript baseline` settles both.
