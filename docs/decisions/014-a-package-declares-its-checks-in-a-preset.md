# ADR-014: A package declares its checks in a preset

**Status:** Superseded by [ADR-017](017-a-package-contributes-through-one-preset.md)
**Date:** 2026-09-27

The owner delegated the mechanism ("go tout faire"); this record states the
decision taken within that delegation.

## Context

[ADR-013](013-adopt-the-tool-before-building-the-check.md) moved import
boundaries to dependency-cruiser and where a name sits to ls-lint. Both
passes read only what the toolchain ships and what the project declares, so
a sibling package, `@jterrazz/test`, could not hand them a rule for every
consumer. Its import and naming rules stayed code of its own, reading an
import's text or walking the tree, because the tool that expresses them had
no entry a package could write into.

## Decision

A package hands its consumers' layers and name rules to the toolchain as a
preset: an object carrying its `name`, its `architecture.layers` and its
`names`, each in the vocabulary a project already writes. The project declares
it in `studio.config.ts`, under `typescript.presets`, and each pass holds the
project to its own declaration and every preset's alike. A project writes its
own name rules under `typescript.names`, in ls-lint's `ls` and `ignore`, each
run as one ls-lint of its own and printed at the file with its lesson.

A preset is declared, never discovered from `node_modules`: what a project is
held to is read in one file, as its oxlint fragments are read in
`oxlint.config.ts`.

## Consequences

- A package moves a rule the tool can express out of its own code, and keeps
  only what the tool cannot say.
- A consumer adopting a package's preset adds one line to its
  `studio.config.ts`; until it does, the preset's rules do not run for it.
- One ls-lint run per name rule costs a tree walk each; the rules a package
  ships are few, and the determinism it buys is the reason: two globs matching
  one directory in one ls-lint config are judged in no stable order.
