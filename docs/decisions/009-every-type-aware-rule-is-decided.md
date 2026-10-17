# ADR-009: Every type-aware rule is decided by name, nursery included

**Status:** Accepted
**Date:** 2026-09-24

Written 2026-09-24 from the evidence it was reconstructed from: commit a2d94b8 (`feat(rulebook): every rule tsgolint runs is decided by name, nursery included`) and the rule-surface suite it extended.

## Context

[ADR-003](003-the-rulebook-is-explicit.md) decides every non-nursery rule of a loaded plugin by name and leaves nursery off wholesale, because upstream declares it unstable. That holds for the rules oxlint runs itself. It does not hold for the rules oxlint hands to tsgolint.

At oxlint 1.83 two of the 59 type-aware rules are nursery: `typescript/no-unnecessary-condition` and `typescript/prefer-optional-chain`. Undecided, they ran nowhere. A tsgolint release can also add a type-aware rule, and "nursery is off" would let it arrive and never be looked at: no suite reads the tsgolint binary, which lists no rules of its own.

## Decision

Every rule `oxlint --rules` marks `type_aware` is in the catalogue, decided by name as `on` or `off` with a reason, nursery or not. The rule-surface suite fails when the installed oxlint forwards a type-aware rule the rulebook does not decide, and its failure message names the rule.

The two nursery rules were decided on measurement, over this package, in 11.0.0:

- `typescript/prefer-optional-chain` is on: 0 reports, and `fix` writes the chain it asks for.
- `typescript/no-unnecessary-condition` is off, kind `evidence`: 8 reports, none a defect: a `while (true)` loop, a flag read off parsed JSON, and `?? ''` guards on `spawnSync` streams that @types/node types as non-null and Node leaves null when the spawn fails.

Nursery rules oxlint runs itself stay off wholesale, as ADR-003 says.

## Consequences

- A tsgolint or oxlint bump that adds a type-aware rule is red until someone decides it. That is the cost, and it is the point: no check reaches consumers undecided.
- A nursery rule's behaviour may change between releases while it is on. `prefer-optional-chain` is on with that risk accepted; the behaviour suite and the ratchet catch a change in what it reports.
- ADR-003's "nursery is off wholesale" now reads "nursery oxlint runs itself is off"; the two records together are the rule.
