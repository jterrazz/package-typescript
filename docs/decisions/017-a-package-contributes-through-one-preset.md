# ADR-017: A package contributes everything it holds through one preset

**Status:** Accepted
**Date:** 2026-09-27

The owner approved the plan this records ("ok pour tout", 2026-09-27); this
record states the decision taken within that approval. It supersedes
[ADR-014](014-a-package-declares-its-checks-in-a-preset.md).

## Context

[ADR-014](014-a-package-declares-its-checks-in-a-preset.md) let a package
hand its layers and name rules to the toolchain as `typescript.presets`. What
a package contributed still arrived by four roads: its oxlint fragment
composed in `oxlint.config.ts`, its layers and name rules in
`typescript.presets`, its settings in a section it read with defaults kept
in its own code, and its debt in a file of its own. The laws every
repository keeps (the direction of `lint/`, the spine, the rosters of the
Names pass) were not a package's contribution at all: each repository
copied the six `lint/` layers into its own `studio.config.ts`, and could
drop one by deleting a line.

## Decision

- A package declares ONE preset: its name (its section, its laws' prefix),
  the defaults of its section, its oxlint config, its layers, its name rules,
  the sections of `studio.baseline.json` it owns, and the presets it
  includes. `typescript.presets` is gone; `presets` is a top-level key.
- `typescript()` is the base preset and is always on. It carries the laws
  every repository keeps; no repository copies them.
- Resolution is one documented, deterministic order: the base preset, then
  the listed presets depth first, then the repository's own additions;
  lists concatenate, records merge, a value the repository writes wins.
- A law is set aside only in the open, under `optOuts`, with its reason, and
  the drift report counts it.
- A package's debt is its preset's section of `studio.baseline.json`,
  judged by the kit's one ratchet engine
  ([ADR-016](016-one-engine-writes-every-rule.md));
  `oxlint-suppressions.json` stays oxlint's own.

## Consequences

- `studio.config.ts` reads as the list of what a repository is held to,
  then what is its own; `oxlint.config.ts` composes the same presets with
  `fromPresets` and names nothing else.
- A repository with a `lint/` tree is held to its direction with no settings
  file; one without runs no cruise for laws that name no file of it.
- A package that relied on `typescript.presets` moves to `presets` in the
  release that carries this record; no bridge reads the old key.
