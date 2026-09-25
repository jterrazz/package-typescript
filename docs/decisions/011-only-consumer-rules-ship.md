# ADR-011: Only consumer rules ship; the rulebook's own contract is audited at home

**Status:** Proposed
**Date:** 2026-09-25

## Context

This package holds two kinds of rule. Most judge a consumer's project: every decision of the six profiles, every pass of `typescript check`. Some judge only this package: the contract every fragment answers to, the catalogue's projection into [Lint presets](../07-lint-presets.md), and the suites that prove the rulebook.

Both kinds shipped together. `lint/_contract.js` refused a broken fragment at load time, so every consumer that imported a profile ran checks that, since `fragment()` is not exported, only this repository could trip, bar the missing id a consumer's `layers()` call could reach. The catalogue module shipped the chapter's renderer, and `files` published every module test beside its module.

The owner decided on 2026-09-24 that every rule a package of the family ships declares an audience, and that only `consumer` rules ship. That decision spans the family's packages, so it is recorded by the corpus that spans them; this record is how this package applies it.

## Decision

Every rule declares `consumer` or `self`, from the closed pair `AUDIENCES` in `lint/_contract.js`. A fragment declares it for every decision it holds, and a pass declares it in `src/cli/check-passes.json`.

A rule mixing the two is split. The contract's builders ship and enforce nothing, and its two invariants are audited by `lint/_contract.test.ts` over every fragment a module of `lint/` exports by default, whether a profile carries it or not. This supersedes the "at load time" clause of [ADR-003](003-the-rulebook-is-explicit.md). The one refusal a consumer can reach, a fragment with no id, which `layers()` builds from the `id` it is given, keeps its consumer half in `layers()`. `catalog()` and `unsafeFixers()` ship, since `fix` reads them, and the chapter's renderer lives in `lint/catalog.test.ts`.

`files` leaves out every `*.test.*` and `*.spec.*`. `specs/surface/package/audience.test.ts` and `tarball.test.ts` hold the split.

## Consequences

- A broken fragment fails this repository's suite, the gate a release passes, instead of every import of a profile.
- The catalogue in [Lint presets](../07-lint-presets.md) lists consumer rules alone; the self rules are described in [Testing](../03-testing.md#who-a-rule-is-for).
- The internal `TYPESCRIPT_CHECK_PASSES` selector is a `self` rule split out of the shipped `bin/commands/check.sh`: it lives in `bin/commands/check-selection.sh`, which the check sources only where it sits beside it, and `files` leaves it and `src/cli/check-passes.json` out of the package. A published check runs every pass.
