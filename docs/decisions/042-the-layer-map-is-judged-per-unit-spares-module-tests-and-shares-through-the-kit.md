# ADR-042: The layer map is judged per unit, spares module tests, and shares through the kit

**Status:** Accepted
**Date:** 2026-11-15

The owner accepted it on 2026-11-15 ("oui pour package-typescript et kit,
vas-y"), told the three defects below and the `presentation/kit/`
recommendation. His word was reported to the maker by the orchestrating
session.

## Context

The Architecture (layer map) pass started one dependency-cruiser run, from
the folder `check` ran in. At a monorepo's root that folder declares no
layers, holds no `src/domain/`, and so derives no hexagonal map: the rule
list was empty and the pass returned before cruising anything. A member's
own `studio.config.ts` layers and its hexagonal layout were never judged
from the root, although the manual said a member's `src/domain/` is held
like the root's. Run from the member's folder, the same pass judged it.
studio-station's `apps/desktop` declares twelve layers that no gate read.

The hexagonal map refused a module test for what a module test is for. The
cruise skips only the ground a test stands on (`__expected__`,
`__fixtures__`, `__requests__`, `__seeds__`) and `.artifacts/`, and the
composition boundaries spared only `specs/`. A test under `__tests__/` that
builds a fake adapter, or the composition root itself, was refused as if
the module it tests had done it.

The map named one shared folder, `presentation/features/common/`, which the
Names (tree) pass refuses: `common` is a grab-bag word of the standard. The
map's one way of sharing between features could not exist in a tree the
toolchain passes. No consumer kept a `features/common/`; studio-station's
desktop member already puts what features and screens share in
`presentation/kit/`, a name the owner chose.

## Decision

- The pass runs once per unit, as Publish does: the root and each
  workspace member that keeps a `studio.config.ts` or a dependency-cruiser
  config, or lays `src/` out as a hexagonal application. Each run reads its
  unit's own settings and cruises its unit's own tree, and the pass reports
  one verdict over them.
- The root's cruise leaves member folders out, and a layer whose `from` or
  `to` opens on a member's folder is inert at the root: a member is judged
  once, by its own map. A workspace root whose code all sits in its members
  has nothing of its own to cruise, and its run passes instead of refusing
  an empty map.
- A finding names its file from the workspace root, so a member's crossing
  opens on the member's folder.
- A member's debt is recorded in the member's own `.studio/baseline.json`,
  which its run reads: `typescript baseline` records each such member after
  the root.
- Every boundary of the hexagonal map spares an importer under
  `__tests__/`, at any depth. A layer a project declares itself is not
  touched.
- `presentation/kit/` replaces `presentation/features/common/` as the
  place features share. A feature reaches no other feature, and reaches the
  kit, which sits beside `features/`; a new boundary,
  `hexagonal-kit-knows-no-feature`, keeps the kit from importing a feature.
  `common` stays a grab-bag word.

## Consequences

- A monorepo whose members declare layers, or are laid out hexagonally, is
  judged on them from the root for the first time, and may turn red on a
  bump. It absorbs that as any stricter release: fix, or record the debt
  with `typescript baseline`, member by member.
- A root's map no longer reaches into a member: the member's map is
  written in the member. The laws a root's preset brings (`@jterrazz/test`'s
  `test()` brings thirteen) used to cruise every member's files from the
  root; they now reach a member through the member's own presets. Every
  member of the estate that holds code declares `test()` itself, and none
  had recorded architecture debt.
- A module test can wire whatever it tests with; what proves a boundary is
  the module's own import, never its test's.
- The map has nine boundaries. A tree with a `presentation/features/common/`
  meets two refusals, the Names pass's and now the feature boundary's, and
  moves the folder to `presentation/kit/`.
