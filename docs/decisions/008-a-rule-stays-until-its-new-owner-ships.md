# ADR-008: A rule stays until its new owner ships

**Status:** Accepted
**Date:** 2026-09-19

Written at decision time, while building the 10.2 asks.

## Context

ADR-002 settles who owns a convention an upstream rule already enforces: the
rule. The estate's test framework, `@jterrazz/test`, is growing a lint
fragment of its own — `testing` — that will set options on three vitest rules
this rulebook currently arms without options:

| Rule                              | What the fragment will set        |
| --------------------------------- | --------------------------------- |
| `vitest/no-restricted-matchers`   | the seven snapshot matchers       |
| `vitest/no-restricted-vi-methods` | four methods, with a message each |
| `vitest/max-nested-describe`      | `{ max: 1 }`                      |

An override's options REPLACE rather than merge, so two owners setting the
same rule is a rule whose configuration depends on composition order. One of
them has to let go, and it is this one: the fragment knows what a spec of that
framework may say, and the rulebook does not.

The mechanism for letting go already exists — `off({ kind: 'covered', by:
'@jterrazz/test testing' })` — and the question is only WHEN it fires. The
fragment ships in `@jterrazz/test` 16.0, which is not released. Every consumer
today is on 15.x.

## Decision

The rulebook keeps a rule until the owner that is taking it over exists in a
released version. These three stay armed in 10.2 and turn `covered` in the
release that follows `@jterrazz/test` 16.0, gated on nothing else.

`covered` is a claim about the present: it says another owner is enforcing
this, and the drift report prints it as a rule deliberately off. Marking a rule
covered by a fragment nobody can install would be false on both counts — the
rule would simply be gone for every 15.x consumer, and the page would say it
was not.

## Consequences

- The handover costs one extra release. That is the price of the two states
  never overlapping: no window where both owners set the options, and no
  window where neither does.
- `10.2.0` therefore does not close §4.3 of the test-system plan. The plan's
  release table owes a row for the release that does.
- The rule is the general one, not a special case for these three: a `covered`
  off names an owner a consumer can install today, or it waits.
- A consumer that adopts `@jterrazz/test` 16.0 before that release gets both
  owners for a while. The fragment composes last, so its options win; the cost
  is a duplicate decision in the drift report, not a wrong rulebook.
