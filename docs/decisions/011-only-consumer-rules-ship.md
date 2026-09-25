# ADR-011: Only consumer rules ship; the rulebook's own contract is audited at home

**Status:** Proposed
**Date:** 2026-09-25

## Context

This package holds two kinds of rule. Most judge a consumer's project: every decision of the six profiles, every pass of `typescript check`. Some judge only this package: the contract every fragment answers to, the catalogue's projection into [Lint presets](../07-lint-presets.md), and the suites that prove the rulebook.

Both kinds shipped together. `lint/_contract.js` refused a broken fragment at load time, so every consumer that imported a profile ran a check only this repository could trip, since `fragment()` is not exported. The catalogue module shipped the chapter's renderer, and `files` published every module test beside its module.

The owner decided on 2026-09-24 that every rule a package of the family ships declares an audience, and that only `consumer` rules ship. That decision spans the family's packages, so it is recorded by the corpus that spans them; this record is how this package applies it.

## Decision

Every rule declares `consumer` or `self`, from the closed pair `AUDIENCES` in `lint/_contract.js`. A fragment declares it for every decision it holds, and a pass declares it in `src/cli/check-passes.json`.

A rule mixing the two is split. The contract's builders ship and enforce nothing, and its two invariants are audited by `lint/_contract.test.ts` over every shipped fragment. This supersedes the "at load time" clause of [ADR-003](003-the-rulebook-is-explicit.md). `catalog()` and `unsafeFixers()` ship, since `fix` reads them, and the chapter's renderer lives in `lint/catalog.test.ts`.

`files` leaves out every `*.test.ts`. `specs/surface/package/audience.test.ts` and `tarball.test.ts` hold the split.

## Consequences

- A broken fragment fails this repository's suite, the gate a release passes, instead of every import of a profile.
- The catalogue in [Lint presets](../07-lint-presets.md) lists consumer rules alone; the self rules are described in [Testing](../03-testing.md#who-a-rule-is-for).
- The internal `TYPESCRIPT_CHECK_PASSES` selector stays a `self` rule inside the shipped `bin/commands/check.sh`: the specs drive the published command, so it cannot move out without a second entry. It is left for the owner to decide whether it should become a consumer switch.
