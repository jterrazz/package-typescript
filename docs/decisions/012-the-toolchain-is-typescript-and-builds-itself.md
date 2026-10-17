# ADR-012: The toolchain is TypeScript, built into `dist/`, and its command is code

**Status:** Accepted
**Date:** 2026-09-27
**Moved since (2026-10-05):** the command's `src/command/` is now `src/commands/<name>/`, one folder per subcommand, and the tools it runs are driven from `src/drivers/<tool>/` ([Architecture § Commands and drivers](../concepts/architecture.md#commands-and-drivers)).

The owner delegated the decision ("go tout faire") on 2026-09-27; this record
states the decision taken within that delegation.

## Context

The package shipped JavaScript as it was written: `files` named `bin`, `lint` and `src`, every `.d.ts` was written by hand beside its `.js`, and a suite held the two value surfaces together. The command was bash (`typescript.sh`, and `check.sh` for the fifteen passes), with a node script per question the bash could not answer.

Three costs grew with it. The sources were never type-checked, since the presets compile `.js` with `checkJs` off; a declaration was a second copy of each entry's surface; and the check, the part of the package every consumer runs, was 776 lines no unit test could reach, whose selection seam for the specs was a rewrite of its text. `@jterrazz/test` already builds with tsdown into `dist/` and runs its checker from there.

## Decision

The package is TypeScript under the preset's strict flags, built by `tsdown.config.ts` into `dist/`, and `dist/` is what ships: every entry of the exports map, the checker program, the oxlint plugin, and each preset a tool loads by path. The declarations are the build's, one owner per type. The JSON presets stay data, served where they are written.

The command is `src/command/`, one module per gesture and a function per step of the check, run by the `typescript` bin, `src/typescript.bin.ts`, a few lines. Its output and exit codes are the bash command's, which the `specs/cli` goldens hold. The specs select passes by handing the command a selection; nothing that ships reads one.

An error the shipped code throws at a project is a four-part refusal reading a heading of the manual; one only the toolchain can cause is `invariant()`. A self audit holds every shipped module to the two forms.

## Consequences

- `make build` precedes `make lint`, `make test` and `make fix`, and the specs drive the built command; a fresh clone type-checks once it has built.
- A consumer reading the package in `node_modules` reads a bundle, not the source it was built from.
- The per-profile shims under `src/presets/oxlint/profiles/` stay: oxlint loads a config handed by path through its default export, and `check` and the drift report hand it one per profile.
- The typed sources carry the debt a type-aware rulebook finds in code written untyped; the ratchet records it and it may only fall.
