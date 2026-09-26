# ADR-011: Only consumer rules ship; the rulebook's own contract is audited at home

**Status:** Accepted
**Date:** 2026-09-25

## Context

This package holds two kinds of rule. Most judge a consumer's project: every decision of the six profiles, every pass of `typescript check`. Some judge only this package: the contract every fragment answers to, the catalogue's projection into [Lint presets](../07-lint-presets.md), and the suites that prove the rulebook.

Both kinds shipped together. `lint/rulebook/decision.js` refused a broken fragment at load time, so every consumer that imported a profile ran checks that, since `fragment()` is not exported, only this repository could trip, bar the missing id a consumer's `layers()` call could reach. The catalogue module shipped the chapter's renderer, and `files` published every module test beside its module.

The owner decided on 2026-09-24 that every rule a package of the family ships declares an audience, and that only `consumer` rules ship. That decision spans the family's packages, so it belongs to the corpus that spans them (the estate's toolchain page, still to be written); this record is how this package applies it.

## Decision

Every rule declares `consumer` or `self`, from the closed pair `AUDIENCES` in `lint/rulebook/decision.js`. A fragment declares it for every decision it holds; every other rule — a pass of the check, a refusal a shipped module or script makes, a meta-test — is a row of one manifest the package does not ship, and a `self` row names the home that holds it.

A rule mixing the two is split. The contract's builders ship and enforce nothing, and its two invariants are audited by this package's own suite over every fragment a module of `lint/` or `src/` exports, whether a profile carries it or not. This supersedes the "at load time" clause of [ADR-003](003-the-rulebook-is-explicit.md). The one refusal a consumer can reach, a fragment with no id, which `layers()` builds from the `id` it is given, keeps its consumer half in `layers()`. `catalog()` and `unsafeFixers()` ship, since `fix` reads them, and the chapter's renderer lives in the suite.

`files` leaves out every `*.test.*` and `*.spec.*`, and the chapter that describes the self rules, [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for), since describing one names it. Two meta-tests hold the split: one reads this checkout, and the other reads what npm would publish, judging its content — every entry it loads, every module it holds, each imported in a child of its own, every rule a packed profile states, every command its `bin` installs, and every file's text — never its file names.

## Consequences

- A broken fragment fails this repository's suite, the gate a release passes, instead of every import of a profile.
- The catalogue in [Lint presets](../07-lint-presets.md) lists consumer rules alone; the self rules are described in [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for).
- The internal pass selector is a `self` rule split out of the shipped `bin/commands/check.sh`, which holds no copy of it and runs every pass whatever its environment holds. The selector lives under `specs/`: the specs run the product command through it, and it runs the published check from its text with the selection in place of the every-pass answer.
- ADR-003 stays `Accepted`; the line under its status marks its "at load time" clause superseded by this record.
