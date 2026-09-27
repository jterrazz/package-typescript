# ADR-013: Adopt the tool before building the check

**Status:** Accepted
**Date:** 2026-09-27

The owner delegated the choice of each tool and its scope ("dependency-cruiser,
ls-lint, rumdl, lychee, oxlint — go, do it all"); this record states the
decisions taken within that delegation.

## Context

The toolchain had grown its own engines for questions maintained tools already
answer: a layer compiler into `no-restricted-imports` overrides that read a
specifier's text, a placement walk for the folders of `lint/`, a regex for a
relative link, a renderer re-drawing oxlint's JSON report in the form oxlint
itself picks, and a ratchet counting oxlint's diagnostics per rule. Each was
code to maintain, to test and to keep in step with the tool it imitated.

## Decision

Where a maintained tool expresses the check, the toolchain ships the tool,
pinned to one exact version, run by `check` and `fix` for every consumer with
no configuration, and keeps its own code only for what the tool cannot express.

- **dependency-cruiser** judges import boundaries on the resolved graph: the
  layer map a project declares in `jterrazz.config.ts`
  (`typescript.architecture`: the shipped `hexagonal` map and its own
  `layers`), each violation printed at its import in four parts. The layer
  compiler, the `hexagonal`/`layers()`/`HEXAGONAL_MAP` oxlint exports and the
  self `lint-direction` map go. Supersedes [ADR-005](005-layer-maps-generate-restricted-imports.md).
- **ls-lint** judges where a name sits: directory case under the named roots,
  the closed folder lists of `lint/`, a skill beside its `SKILL.md`. The gate
  keeps the deny-word rosters (RE2 has no negative lookahead), the spine and its
  declared roots, what a declaration exports and which family a rule belongs
  to, the Makefile gestures and empty directories.
- **rumdl** judges Markdown: a missing file or anchor (MD057, MD051), a fence
  with no language, and the rest of its defaults but layout, which is oxfmt's.
  The prose gate keeps backticked coordinates, a skill's chapters and the
  readability floors.
- **`publish/no-test-code-in-production` stays ours**, and is not moved to
  dependency-cruiser. It judges the built chunks, not the source graph: an
  installed test package the bundler inlined, or an external specifier the
  manifest does not declare, exists only in tsdown's output, and a cruise of
  the source never sees either. There is one owner for each part. What test
  material IS belongs to `@jterrazz/test`: the pass loads the readers from its
  `./oxlint` entry and keeps no copy. The source edge belongs to that
  package's `no-test-code-in-production` rule. The tarball belongs to this pass.
- **lychee** is not adopted: local links are rumdl's offline MD057/MD051, a
  remote link needs the network `make check` never uses, and lychee ships no
  npm package the toolchain could pin.
- **oxlint's own output** is what the Oxlint pass prints; the renderer goes.
- **oxlint's `reportUnusedDisableDirectives`**, which every profile compiles at
  `error`, refuses a directive that suppresses nothing. `suppressions/no-dead-suppression`
  goes: it reported the same directive a second time, and it saw less — never
  a live rule that stopped firing, never a JS plugin's rule. The Suppressions
  pass keeps a directive's spelling and its reason, which oxlint does not judge.
- **oxlint's `typescript/ban-ts-comment`**, armed with `ts-ignore` banned and
  `ts-expect-error` allowed with a description, refuses a bare `@ts-ignore` and
  an undescribed `@ts-expect-error`. The Suppressions pass reports neither: it
  would be the same directive reported a second time. It keeps only the
  `@ts-ignore` → `@ts-expect-error` rewrite in `fix`.
- **oxlint's bulk suppressions** hold the lint debt: `oxlint-suppressions.json`,
  exact per file and rule, both ways. `jterrazz.baseline.json` keeps only what
  no linter judges — the Architecture, Names and Comments passes, and `@jterrazz/test`'s
  checker passes. It requires every rule to error: oxlint holds errors alone, so
  the warn tier goes, here and in `@jterrazz/test`. Supersedes, in part,
  [ADR-006](006-a-ratchet-not-a-big-bang.md): the ratchet stays, oxlint holds it.

## Consequences

- Fewer lines of our own, and each judge is the one its ecosystem maintains.
- A consumer composing `layers({ map: HEXAGONAL_MAP })` moves the map to
  `jterrazz.config.ts` (`typescript: { architecture: { hexagonal: true } }`);
  one keeping oxlint rules in `jterrazz.baseline.json › typescript` or
  `jterrazz/*` keys in its `test` section runs `typescript baseline`, then
  `jterrazz-test-check baseline`.
- oxlint's suppression flags are not in its `--help` yet: the version is pinned,
  specs run each flag, and an oxlint bump is a decision rather than a range.
- oxlint rewrites the suppressions file on every `--fix` run for the rules that
  run armed, so every narrowed fix run — the unsafe-fixer wrapper, the plugin's
  own fixes — keeps the file across itself.
- dependency-cruiser gives no editor feedback where the oxlint override did;
  a boundary is judged by `check`, not in the editor.
