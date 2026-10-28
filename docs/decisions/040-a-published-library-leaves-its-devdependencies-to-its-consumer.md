# ADR-040: A published library leaves its devDependencies to its consumer

**Status:** Proposed
**Date:** 2026-10-28

## Context

`@jterrazz/intelligence` ships a `./config` entry, a preset the consumer's
toolchain loads, which imports `@jterrazz/typescript/config`. The build
bundles every package that is neither a dependency nor a peer, so the
package declared the toolchain an optional peer to keep it out of `dist/`.

npm counts an installed optional peer of a production dependency as
production. Every consumer holding `@jterrazz/typescript` as its own
devDependency therefore kept it, and what it pulls in, through
`npm ci --omit=dev`: on 2026-10-28 the images of signews-api and
jterrazz-web carried ls-lint, oxlint, Stryker and vitest, and 15 critical
vulnerabilities in their Go binaries, none of which production runs.
Dropping the peer made the build try to bundle the toolchain's
declarations, and fail.

## Decision

- A published library (`kind: 'library'`, not `private`) leaves external
  every package it holds as a devDependency alone, besides the dependencies
  and peers tsdown leaves external already. A types package is no module,
  and stays out.
- A name left external covers its subpaths: `@jterrazz/typescript` leaves
  `@jterrazz/typescript/config` to the consumer too. tsdown matches the
  strings it never bundles against the whole specifier, so the build hands
  it one matcher (`neverBundled`), in the config it generates and in the
  build the publish guard reads.
- A private library, and every application, bundles as before: a private
  extension or an api ships what it bundles, and its devDependencies are
  gone from the image that runs it.
- The publish guard is unchanged: a test package a published build imports
  must still be declared in `dependencies` or `peerDependencies`. A test
  package held as a devDependency is now imported rather than compiled in,
  and the guard names the import.

## Consequences

- A preset entry needs no peer: `@jterrazz/intelligence` drops
  `@jterrazz/typescript` from its peers, and its consumers' production trees
  lose the toolchain.
- A published library can no longer inline a devDependency on purpose; one
  it means to ship goes in `dependencies`.
- A testing entry (`@jterrazz/manifest/testing` importing `vitest`) still
  needs its test runner declared as a peer, so npm still counts it
  production in its consumers. Whether a testing entry may rely on a
  devDependency instead is a decision about the guard, left open.
