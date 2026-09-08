# ADR-002: The manual is a gate of the toolchain

**Status:** Proposed
**Date:** 2026-09-08

Written at decision time, implementing the owner's decision of 2026-09-08
that every repository carries the same `docs/` spine. The spine itself is
recorded outside this repository, by the corpus that spans the repositories
it binds; what is recorded here is the mechanism, which this package alone
can falsify.

## Context

The spine was doctrine nobody could check. Nineteen shapes across the
ecosystem's docs trees, fifteen repositories with no manual at all, and a
reader landing on an unfamiliar repository unable to say where the
architecture is. Doctrine that only a reviewer enforces is doctrine that
drifts.

Three places could have held the rules: an oxlint rule, a consistency suite
in the operating system's own tests, or this toolchain. Oxlint judges source
files, and the subject here is a directory listing plus a few first lines. A
suite in the OS could only judge the clones present on one laptop. The gate
belongs where every repository's own CI already runs it.

## Decision

The rules are a pass of `typescript check`, `Docs (layout)`, and three calls
shape it:

1. **The rule engine is pure and exported.** `auditDocs(tree)` at
   `@jterrazz/typescript/docs` takes a plain description of a `docs/` tree
   and returns violations; `node:fs` appears only in `lib/check-docs.js`.
   The gate has two readers — a project it is installed in, and an estate
   sweep over clones nothing is installed into — and one engine keeps the
   rule ids, the sentences and the journal-word roster in a single
   executable copy.
2. **The pass measures from the REPOSITORY, not the package.** Every other
   per-package gate measures from the nearest `package.json`; this one asks
   its question where a `.git` is. A manual answers for a whole tree, and
   only its root carries the `AGENTS.md` that routes into it. Nothing else
   gates the pass: a repository with no `docs/` is not exempt, it is the
   case the rule exists for.
3. **The `04-operating.md` presence test is derived, and the lint only ever
   requires.** Three filesystem facts decide it — a `Dockerfile`, an
   `.infrastructure/`, a non-private root manifest — and no configuration
   key exists. A repository that ships by a tagged release writes the
   chapter without being asked, and hears nothing if it does not.

A bare entry, `typescript docs-layout <root>`, runs the same gate on a tree
with no npm project, for the Go, Rust and Ansible repositories that wire it
into their own `make lint`.

## Consequences

- A repository with no manual goes red on the bump that brings this version
  in. That is the point, and it is why a bump and a migration land in the
  same pull request.
- The pass says nothing outside a git tree — a fixture directory, a
  workspace member linted on its own. That is the price of the repository
  unit, and it is why the pass is proved by a chain that builds a real
  repository rather than by a document over a fixture.
- The plan this implements said the pass runs unconditionally. It does not:
  asking a fixture project for a manual would have turned every `check`
  document red about a claim the rule never makes. No repository is exempted
  by the change — every one of them has a `.git`.
- A second reader of the rules is now possible without a second copy of
  them, which is what the `./docs` export exists for. Nothing else in the
  package is exported for a reason that is not a consumer's config.
