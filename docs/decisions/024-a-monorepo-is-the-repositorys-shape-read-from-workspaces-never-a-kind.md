# ADR-024: A monorepo is the repository's shape, read from workspaces, never a kind

**Status:** Accepted
**Date:** 2026-10-15
**Accepted:** 2026-10-15: the owner's word, "a monorepo is the repository's shape, never a kind".
**Amends:** [ADR-018](018-a-project-declares-what-it-is-and-every-config-follows.md): `workspace` leaves the kinds.

## Context

[ADR-018](018-a-project-declares-what-it-is-and-every-config-follows.md)
made `kind` a closed union, and `workspace` sat in it beside `library`,
`api`, `cli`, `website` and `mobile`. It was never one of them. The five
describe a project: what it ships, whether npm publishes it, which build
and which manifest it owes. `workspace` described none of that.

Its standard was empty, it declared no platform, its publication read
`members`, and every branch on it asked one question: does this root hold
members? npm already answers that question in the manifest's
`workspaces`, and `lint/kit/project/workspace-members.ts` already read it
for every pass that walks the members. So a repository said it twice, once
for npm and once for the toolchain, and the two could disagree: a root
listing members while declaring a library read its own sources as a member
of itself, and a root declaring `workspace` while listing nothing had no
member to judge.

## Decision

- `kind` describes a project only: `library`, `api`, `cli`, `website`,
  `mobile`. `workspace` is gone, with its standard.
- Monorepo or not is never declared. It is read from the root manifest's
  `workspaces`, or from `pnpm-workspace.yaml`'s `packages` (pnpm keeps no
  `workspaces` field). `isMonorepoRoot` and `workspaceMembers` in
  `workspace-members.ts` are the one reader of that fact. A pass that runs
  per member branches on them, never on a kind.
- The root `studio.config.ts` is the repository's config: its roots, its
  oxfmt and oxlint ignores and overrides, its knip entries, its docs, its
  presets. In a single-project repository the root is the project, so the
  file also declares its kind and platform. In a monorepo the root declares
  no kind and no platform, and each member's own config declares its own.
  A monorepo root whose config would be `defineConfig({})` keeps none: a
  missing file at the root of a monorepo declares nothing, as it should.
- The Config pass holds the shape, and each refusal says what to do:
    - a kind or a platform at the root of a monorepo is
      `config/kind-matches-manifest`: drop them from the root and keep only
      the repository's settings there.
    - a root that lists `workspaces` and is not `private` is
      `config/kind-matches-manifest`: the root of a monorepo is a container,
      never a published package. Set `"private": true` and publish a member.
    - a project declaring a kind beside `workspaces` is
      `config/kind-matches-manifest`: its own sources would be read as a
      member of itself.
    - a project, that is a `package.json` that is no monorepo root, without
      a kind is `config/project-declared`, as before. The one exception is
      the monorepo's own suite at `specs/`, which declares its platform
      alone.
- Nothing else changes. One `typescript check` from the root still judges
  each member by its own kind and platform. The root still derives the
  repository's `oxlint.config.ts` and `oxfmt.config.ts`, and still keeps
  no `tsconfig.json`.

## Consequences

- npm owns the fact, so the two can no longer disagree. Adding a member
  is adding it to `workspaces`.
- `kind` says what a project ships, and every row of the kind matrix is a
  project. The monorepo specimen moved from `specs/kinds/workspace/` to
  `specs/shapes/monorepo/`, a shape beside the kinds, and its root keeps no
  config.
- A repository that declared `kind: 'workspace'` is refused until the
  line goes: the kind is no longer in the union, and the refusal names the
  fix. A root left empty by dropping it is deleted.
- A monorepo root that npm would publish was accepted before and is now
  refused.
