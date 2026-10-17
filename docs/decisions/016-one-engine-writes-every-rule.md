# ADR-016: One engine writes every rule of the family

**Status:** Accepted
**Date:** 2026-09-27
**Amended by:** [ADR-019](019-mutation-judges-zero-survivors-not-a-score.md), for the floor judge: the kit judges exact debt alone.

The owner approved the plan this records ("ok pour tout", 2026-09-27); this
record states the decision taken within that approval.

## Context

Two packages of the family judge their consumers with code of their own:
this toolchain, and `@jterrazz/test`. Each grew an engine under
`lint/engine/`, and the two engines had converged on the same parts written
twice: the four-part lesson and its `refusal()`, the section of
`jterrazz.baseline.json` and its exact ratchet, the git-aware walk, the
workspace members, the reserved ground folders (two `ground.ts`), the
suppression directives, the generated catalogue tables. Two copies of one
reader answer one project two ways: the member list the ratchet counts over
had to be kept "the same list" by a comment.

## Decision

This package exports the engine it judges itself with as
`@jterrazz/typescript/rules`, and a sibling writes its rules with it:

- a rule is a catalogue row (`name`, `family`, `audience`, `sentence`,
  `fix`), and `defineRule` / `defineCheck` write its four-part message from
  the row and the finding;
- the catalogue renders into its chapter between markers, padded as the
  formatter pads it;
- the check plumbing: the command line, the positioned finding, `stop()`
  and `exitCodeOf()`, the checker of a set of passes;
- the baseline file, section by section, with two judges: exact debt and a
  floor that only rises; a judge returns what broke without a read, and its
  caller writes the chapter it reads in place;
- the readers of a project: the git tree, the workspace, the manifest and
  its exports, ONE list of ground folders, the suppression directives, the
  settings file resolved through its presets.

A sibling's own engine keeps only what no other package reads.

## Consequences

- A reader has one owner: a fix to the walk or to the ratchet lands once and
  reaches every package that judges a tree.
- The kit is public surface, so a change to it follows the version of this
  package, and a sibling takes it by a bump.
- `@jterrazz/test` reads the kit at runtime; `@jterrazz/typescript` stays the
  peer it already was.
