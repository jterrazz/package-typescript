# ADR-015: The family states its settings in one file, and its debt in another

**Status:** Accepted
**Date:** 2026-09-23

Written 2026-09-27 from the working page of the 17 release, where the owner
took this decision on 2026-09-23; it was folded here when that page was
deleted.

## Context

Two packages of the family read a repository's own choices: this toolchain
(the roots a repository keeps beside its spine, later its layer map) and
`@jterrazz/test` (its own section). Each had also started to record a
ratchet of its own, in a file of its own at the root.

The first home tried for the choices was a `jterrazz` key in `package.json`,
one sub-property per package. It had two faults. `package.json` ships in
the tarball and churns with every dependency bump, so a reasoned decision
sat in the one file every release and every bot rewrites. And the ratchets
stayed out of it for the opposite reason: a count is a measurement a tool
rewrites on every recording, and a decision is rare and reasoned, so the two
never belong in one file.

## Decision

- **One settings file for the whole family**, `jterrazz.config.ts` at the
  root, typed by `defineConfig` from `@jterrazz/typescript/config`. This
  package owns the file and the `JterrazzConfig` interface; a sibling adds its
  own section by declaration merging, as `@jterrazz/test` adds `test`. Each
  package reads its own section and nothing else. A repository with nothing
  to say keeps no file, and a workspace member may keep its own beside its
  `package.json`. No `jterrazz` key is read from `package.json`.
- **One generated file for the debt no linter holds**, `jterrazz.baseline.json`,
  one section per package. Each package's command reads, judges and writes
  its own section alone and keeps every other section byte for byte. A
  per-package file is not read.

## Consequences

- A reader finds every choice a repository made about its toolchain in one
  file, and every debt it recorded in another; neither churns with the
  other.
- `@jterrazz/typescript` is a required peer of `@jterrazz/test`, since the
  types that package publishes name `@jterrazz/typescript/config`.
- The file is TypeScript, loaded by Node with its types stripped: a setting
  is checked by the compiler where it is written, and needs no build.
- Oxlint's own diagnostics later left the shared file for oxlint's
  `oxlint-suppressions.json` ([ADR-013](013-adopt-the-tool-before-building-the-check.md));
  what `jterrazz.baseline.json` still holds is
  [Quality checks § The ratchet](../06-quality-checks.md#what-jterrazzbaselinejson-still-holds)'s.
