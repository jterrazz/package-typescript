# ADR-025: A repository with no code declares `content` and keeps the passes that mean something

**Status:** Accepted
**Date:** 2026-10-15
**Accepted:** 2026-10-15: the owner's decision, question 12 of the vision 17 review: `typescript check` gets a door for a repository without `package.json`, a `kind: 'content'` project that runs only the passes that mean something there.
**Amends:** [ADR-018](018-a-project-declares-what-it-is-and-every-config-follows.md): `content` joins the kinds.

## Context

Six repositories of the estate hold no TypeScript: a Helm and Ansible
infrastructure, a vault of signed articles, a gateway of YAML and a
Dockerfile, a workflow library, a Rust application and a Swift one. Each
carries a manual, Markdown, scripts and YAML, and each asked the same
thing in its report: `typescript check` judged it as a JavaScript project.
The Config pass demanded a kind from a closed list of JavaScript shapes,
Knip aborted for want of a `package.json`, Names refused every root
outside a spine of `src/`, and demanded the six gestures of a Makefile
that has nothing to install or build. The only gate reachable was
`docs-layout`, which has a door of its own for any tree.

Forcing a `package.json` and a `studio.config.ts` to silence them was
refused by all six: it invents a JavaScript project. The two other doors
proposed (one command per tree pass, or a skip list) put the knowledge of
what a repository without code owes in each caller.

## Decision

- `content` is a kind: a repository whose product is not built, typed or
  linted by this toolchain. Its declaration is the least ceremony the
  toolchain can read: a `studio.config.ts` with no `package.json`, which
  needs no import, since the file is a plain object:
  `export default { kind: 'content' };`.
- It declares no platform: it runs no code, so a platform beside it is
  refused. A `package.json` beside it is refused as
  `config/kind-matches-manifest`: a manifest makes the repository a project,
  which declares the kind it is.
- `typescript check` and `typescript fix` run seven passes on it, and no
  other: Config, Gitignore, Docs (layout), Comments, Markdown, Names and
  Secrets. The reason of each pass, kept or dropped, is the table of
  [Quality checks § A repository with no code](../reference/quality-checks.md#a-repository-with-no-code).
  The choice is one set, `CONTENT_PASSES`, applied once where the run is
  prepared: a pass nobody lists does not run, in any mode.
- Names judges a content repository by what it declares itself
  (`typescript.names`) and by the empty folders it leaves. It holds it to no
  spine of roots and to no Makefile gestures.
- The derived editor files (`oxlint.config.ts`, `oxfmt.config.ts`,
  `tsconfig.json`) are not derived: nothing reads them.
- `typescript baseline` records a content repository's names debt, and
  runs no linter over the scripts it carries.
- `typescript.roots.<folder> = { reason, verbatim: true }` keeps its meaning:
  the one declaration that leaves a tree of signed text as written, for
  every pass that runs.

## Consequences

- A repository without code is judged on the prose, the tree, the manual,
  the comments and the credentials it holds, with the same gates as the
  rest of the estate and no file invented for them.
- The formatter does not run on it: no oxfmt rewrite of a YAML twin, of a
  Helm template or of an Xcode-owned JSON. Markdown layout is rumdl's.
- A content repository owes no Makefile; whether it wires `make lint` is its
  own call. The line it wires is `npx typescript check`.
- Comments is not softened: a content repository whose comments state no
  kind fails as any other does. Whether the infrastructure repository is
  under that rule remains the owner's question, not the door's.
- A new pass is a decision twice: it is added to `CONTENT_PASSES` or it is
  absent from it, and the table says why.
