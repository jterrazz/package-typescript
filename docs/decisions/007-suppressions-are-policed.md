# ADR-007: Suppressions are policed

**Status:** Proposed
**Date:** 2026-09-15

Written at decision time, as part of v10. The evidence is the audit of the
ecosystem's twenty-eight repositories, read on 2026-09-15.

## Context

The audit found `eslint-disable` comments across a fleet that runs no ESLint.
Most were inert text; a few sat above code their author believed was exempt
and that nothing had exempted for two years. Nothing anywhere required a
suppression to say why it was written, and nothing noticed when the rule a
directive named had been off in the resolved config all along.

A suppression is the one place a project overrules its own rulebook. Leaving
it unpoliced makes the rulebook advisory in exactly the spots where somebody
already decided it should not apply — and those spots are invisible, because
a suppression is a comment.

The alternative was to forbid suppressions outright. That was rejected: a
project genuinely knows things a shared profile does not, and a rule with no
escape hatch gets escaped by turning the rule off for the whole repository,
which is strictly worse and strictly less visible.

## Decision

A suppression is allowed, and it is held to three things, as a pass of
`typescript check`:

- **Spelled in this toolchain's vocabulary.** `eslint-disable*`,
  `biome-ignore` and `@ts-ignore` are refused; `oxlint-disable*` and
  `@ts-expect-error` are the forms. `typescript fix` rewrites the two a
  machine can settle.
- **Carrying its reason.** An `oxlint-disable*` needs `-- reason` after it;
  a `@ts-expect-error` needs a description. `fix` never invents either.
- **Naming a live rule.** A directive naming a rule the resolved config does
  not have on is dead text, and dead text is reported.

The count of suppressions is one of the four numbers the drift report prints,
so a repository accumulating them says so on every run.

The same principle governs a rule turned OFF in a consumer's config:
`drift-unreasoned` refuses a line that disables a rule the profile has on
without a `// reason:` comment on that line. Both are the same rule, applied
to the two scales at which a project overrules its rulebook.

## Consequences

- Every override in the estate becomes greppable, reasoned, and countable.
- A directive naming a JS plugin's rule cannot be judged: those rules never
  appear in `oxlint --print-config`. The gate stays silent there rather than
  calling a live rule dead, so `suppressions-dead` under-reports by design.
- A file DISCUSSING a suppression is not one. The gate reads a directive only
  at the opening of a comment, which is where a checker reads one — its own
  source, full of the spellings it refuses, passes it.
- Repositories adopting v10 will find existing directives failing the pass.
  That debt is not covered by the oxlint baseline, which counts oxlint's
  diagnostics and not this gate's; a repository fixes its directives in the
  adoption pull request. There are few of them, and `fix` settles the
  mechanical half.
