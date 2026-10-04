# Glossary

The words this manual uses, one meaning each.

## Running the gate

- **The command** — the `typescript` binary and what runs behind it. `typescript check` is the gate a project runs; `make check` is the gate a repository runs, the command among the rest.
- **Pass** — one question `check` asks, printed under its own `RUN` header: TypeScript Check, Oxlint, Names (tree) and the rest ([Quality checks § The passes](quality-checks.md#the-passes)). Every pass is a **gate**: it fails the run on any finding.
- **Finding** — one thing a pass refuses: a position, a rule id such as `names/no-grab-bag-name`, and a **lesson** in four parts, `found · why · fix · read`, whose `read` is a heading of this manual.
- **Ratchet** — a recorded debt that may only fall. `typescript baseline` writes the **baseline**, today's counts, into `.jterrazz/oxlint-suppressions.json` and `.jterrazz/baseline.json`; a count that grows fails the run, and one that falls is lowered by `fix` ([Quality checks § The ratchet](quality-checks.md#the-ratchet)).
- **Drift** — how far a project stands from its profile: rules set apart, suppressions, baseline counts, tool versions, laws set aside. It is reported at the end of every `check`, not judged ([Quality checks § The drift report](quality-checks.md#the-drift-report)).

## Declaration, profiles and presets

One word per meaning:

- **Declaration** — what a project says it is in `jterrazz.config.ts`: its **kind** (`library`, `api`, `cli`, `website`, `mobile`, `workspace`) and its **platform** (`node`, `bun`, `react`, `next`, `astro`, `expo`). Every law, check and derived file follows from it ([Getting started § Declare what the project is](../start/getting-started.md#1-declare-what-the-project-is)).
- **Profile** — which framework's lint rules a project takes, one of six ([Lint presets § The profiles](lint-presets.md#the-profiles)). The platform picks it.
- **Preset** — what a package holds a project to, listed under `presets` in `jterrazz.config.ts`: lint rules, layers, name rules, checks, debt and settings ([Configuration § Presets](configuration.md#presets)).
- **Base preset** — the preset of this package, which the declaration derives: always on, never listed; it carries the family's laws ([Configuration § The base preset](configuration.md#the-base-preset)).
- **Package preset** — the preset a sibling package contributes beside it, such as `test()` from `@jterrazz/test`.
- **Derived file** — a file at the root an editor reads, whose whole content the declaration decides: `oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json` ([Quality checks § The Config pass](quality-checks.md#the-config-one-file-pass)).
- **Config preset** — a file a tool's own config extends rather than a preset: the tsconfig presets (`@jterrazz/typescript/tsconfig/node` and the others), and the knip preset the command derives knip's config from. [Lint presets](lint-presets.md) is the rulebook the profiles carry.

## The two shapes

- **The manual's shape** — the sections every repository's `docs/` is cut into, and the pages each one holds ([Quality checks § The Docs pass](quality-checks.md#the-docs-layout-pass)).
- **The root spine** — the folders a repository root may hold without declaring them ([Quality checks § The root spine](quality-checks.md#the-root-spine)).
