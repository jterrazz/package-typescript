# ADR-010: A spec file's size has one judge, @jterrazz/test's C33

**Status:** Proposed
**Date:** 2026-09-24

Written 2026-09-24 from the evidence it was reconstructed from: commit 139b8b9 (`feat(rulebook): size is capped — 300 lines a file, 60 a function`) and the `max-lines` rows of the catalogue in [Lint presets](../07-lint-presets.md).

## Context

11.0.0 turns `max-lines` on at 300 lines a file. `@jterrazz/test` already caps a spec file: C33, a rule of its lint plugin, holds every `*.spec.ts` to 400 lines, and its findings are that package's debt, recorded in its own section of the baseline.

Two caps on one file would disagree. A spec between 301 and 400 lines would pass C33 and fail `max-lines`, and a spec past 400 would be reported twice, in two sections of the baseline, by two owners whose limits say different things about what a spec may hold.

## Decision

`max-lines` is off for `*.spec.ts`, kind `covered`, naming C33 as the rule that judges it. The scope is the suffix C33 reads, its role `spec`, and nothing wider: every other file under `specs/` — a module test, a `*.specification.ts`, a helper — is code, and holds 300.

`max-lines-per-function` stays on everywhere, specs included, at 60: C33 counts files, not functions, so nothing else judges a function's size.

## Consequences

- A spec file's limit is whatever `@jterrazz/test` says it is. If C33 is retired, this `off` names an owner that judges nothing, and it goes with it: a `covered` off names an owner a consumer can install today ([ADR-008](008-a-rule-stays-until-its-new-owner-ships.md)).
- A consumer that names files `*.spec.ts` without using `@jterrazz/test` has no size cap on them at all. The gap is accepted: the suffix is that framework's convention, and the rulebook does not judge one file twice to close it.
- One finding, one section: a long spec is `@jterrazz/test`'s debt in `jterrazz.baseline.json › test`, never this package's.
