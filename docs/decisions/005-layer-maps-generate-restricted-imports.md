# ADR-005: A layer map generates the restricted-import overrides

**Status:** Proposed
**Date:** 2026-09-15

## Context

Architecture boundaries were a hand-written oxlint JS plugin,
`codestyle/arch-hexagonal`: a regex over the filename crossed with regexes over
the import specifier. It carried its own rule file, its own schema, and its own
fixer-less report, and it paid the JS-plugin toll on every invocation.

oxlint's native `no-restricted-imports` expresses the same claim — `patterns`
with gitignore-style `group` globs, scoped per directory through `overrides` —
at no cost, and `import/no-cycle` rides along for +0.05s.

## Decision

A layer map is data: `{ name, files, deny, allow, message }` per layer.
`layers({ map })` compiles it to one `no-restricted-imports` override per layer,
and `hexagonal` is the map this package ships, carrying the six boundaries the
plugin enforced.

Three properties of oxlint shape the generated config:

1. An override's rule **options REPLACE** the base entry — they never merge
   (oxc#17527). Each layer's override therefore carries that layer's complete
   pattern list, and nothing about layering is left in the base config. A map
   whose layers share a `files` glob is refused at build time rather than
   shipped, because the second override would silently erase the first.
2. The `regex` matcher is **Rust regex, which has no lookahead**. The one
   exception in the hexagonal map — features may not import features, except
   `features/common` — is two globs: the deny glob, then the same glob negated
   with `!`.
3. `no-restricted-imports` matches the **specifier string**, never a resolved
   path.

## Consequences

- The JS plugin is deleted. With `import/extensions` covering the two extension
  rules as well — including the dotted module name (`./entities/user.entity`)
  that the hand-written rule needed a 28-entry allowlist for — nothing is left
  in it, and this package ships no oxlint rules of its own.
- A boundary is now declared where it is read, in the map, and a second map is a
  data literal rather than a second plugin.
- The textual limit is inherited: `../beta/thing.js` does not carry the layer
  name and passes. Where a repository needs a resolved graph, that is
  dependency-cruiser's job, wired beside this and not instead of it.
- `import/extensions` is not auto-fixable in oxlint, where the deleted rules
  were. `typescript fix` no longer adds or strips an extension for you.
