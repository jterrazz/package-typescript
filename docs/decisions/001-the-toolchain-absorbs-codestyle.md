# ADR-001: The toolchain absorbs codestyle

**Status:** Accepted
**Date:** 2026-07-13

Retroactive record, written 2026-09-04 from the migration record (all repos
flipped 2026-07-13/15). Moved into this repository 2026-09-06, from the OS
wiki where it was ADR-002 — this package alone can falsify it.

## Context

`@jterrazz/typescript` and `@jterrazz/codestyle` were two packages that were
circularly coupled — codestyle's typechecking needed typescript's tsconfig
presets — and always installed together.

## Decision

`@jterrazz/typescript@6` is the unified toolchain — build, lint, format,
typecheck, unused-code, docs — and `@jterrazz/codestyle` is deprecated, never
added to a new project. A consumer carries ONE devDependency, runs
`typescript check` / `typescript fix`, and its tsconfig is a single `extends`
of a preset (`node` / `next` / `expo`); a local compilerOption is a smell.

## Consequences

- The oxlint plugin keeps its historical `codestyle/` rule prefix — an
  internal name, not a package.
- Deep imports with explicit extensions need `*.js`-suffixed export patterns;
  a self-reference test in the package guards the exports map.
- Every product repo was migrated within two days — the family's "no legacy"
  law applied to its own toolchain.
