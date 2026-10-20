# ADR-027: A release rehearses on Linux through the toolchain

**Status:** Accepted
**Date:** 2026-10-19

The owner accepted it on 2026-10-20 ("tout ok").

## Context

Vision 17's first release runs (2026-10-19) failed on the GitHub runner on
five differences of host that no gate on the owner's Mac could see: oxlint's
report form under `GITHUB_ACTIONS`, a Node patch that moved a loader frame,
vitest's colours under `CI`, Linux's `ps -o comm`, and a container running as
root that read chmod-000 fixtures the non-root runner cannot. The release
session answered with a script run by hand: a fresh clone of the branch in
`node:24` under Docker, `CI` and `GITHUB_ACTIONS` set, the gate as the
image's `node` user. The estate's wiki planned to make it a target of each
package's Makefile, and the script had already forked once, into a bun
variant for the OS.

## Decision

The rehearsal is a command of the toolchain, `typescript rehearse`, and a
repository's Makefile only calls it. The command reads what the recipe needs
from the repository instead of asking: the branch checked out, the installer
its committed lockfile names (npm, bun at the version `packageManager` pins,
or pnpm), Go where git tracks a `go.mod`, a browser where the manifest
declares `playwright` or `@playwright/test`, and the main checkout's git
directory where the checkout is a worktree. `--branch` and `--targets` name
another branch and other make targets; the default is `build lint test`,
mutation off.

## Consequences

- One recipe for every repository of the estate: a fix to it (a new host
  difference, a tool to provision) ships in a release and reaches every
  repository on its next bump, where a Makefile target would be copied twenty
  times and drift.
- The toolchain gains a public command that spawns Docker and needs the
  network; no `check` calls it, and its unit tests prove the run it composes,
  not a container.
- A repository whose gate needs more than the command provisions (a tool it
  does not detect) cannot add it locally; it asks the toolchain for a rule of
  detection, as it would for any other config the declaration derives.
