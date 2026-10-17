# Glossary

The words this manual uses, one meaning each.

## Running the gate

- **The command**: the `typescript` binary and what runs behind it. `typescript check` is the gate a project runs; `make check` is the gate a repository runs, the command among the rest.
- **Pass**: one question `check` asks, printed under its own `RUN` header: TypeScript Check, Oxlint, Names (tree) and the rest ([Quality checks § The passes](quality-checks.md#the-passes)). Every pass is a **gate**: it fails the run on any finding.
- **Finding**: one thing a pass refuses: a position, a rule id such as `names/no-grab-bag-name`, and a **lesson** in four parts, `found · why · fix · read`, whose `read` is a heading of this manual.
- **Ratchet**: a recorded debt that may only fall. `typescript baseline` writes the **baseline**, today's counts, into `.jterrazz/oxlint-suppressions.json` and `.jterrazz/baseline.json`; a count that grows fails the run, and one that falls is lowered by `fix` ([Quality checks § The ratchet](quality-checks.md#the-ratchet)).
- **Tree gate**: a pass the command's own checker answers over the files of the tree rather than a tool's program: Gitignore, Suppressions, Markdown, Names and Secrets ([Quality checks § The passes](quality-checks.md#the-passes)).
- **Sweep**: the files every tree gate and the linter read: every file git does not ignore, tracked or new, or the whole disk outside a git checkout ([Quality checks § Leaving a path out](quality-checks.md#leaving-a-path-out)).
- **Unit**: what a per-package pass measures from: the nearest `package.json`, so each member of a workspace is a unit of its own, and a single-package project is one ([Architecture § The unit is the workspace package](../concepts/architecture.md#the-unit-is-the-workspace-package)).
- **Gesture**: one of the six `make` targets every repository answers at its root, `install`, `build`, `lint`, `fix`, `test` and `check` ([Quality checks § The six gestures](quality-checks.md#the-six-gestures)).
- **Drift**: how far a project stands from its profile: rules set apart, suppressions, baseline counts, tool versions, laws set aside. It is reported at the end of every `check`, not judged ([Quality checks § The drift report](quality-checks.md#the-drift-report)).

## Declaration, profiles and presets

One word per meaning:

- **Declaration**: what a project says it is in `jterrazz.config.ts`: its **kind** (`library`, `api`, `cli`, `website`, `mobile`) and its **platform** (`node`, `bun`, `react`, `next`, `astro`, `expo`, `browser`). Every law, check and derived file follows from it. The root of a monorepo declares none: a monorepo is the repository's shape, read from `workspaces`, never a kind ([Getting started § Declare what the project is](../start/getting-started.md#1-declare-what-the-project-is)).
- **Profile**: which framework's lint rules a project takes, one of six ([Lint presets § The profiles](lint-presets.md#the-profiles)). The platform picks it.
- **Preset**: what a package holds a project to, listed under `presets` in `jterrazz.config.ts`: lint rules, layers, name rules, checks, debt and settings ([Configuration § Presets](configuration.md#presets)).
- **Standard**: the data a package holds every project to by default, under its `src/standard/`; this package's, merged for the declaration's kind and platform, is its own preset, always on and never listed, carrying the family's laws ([Configuration § The standard](configuration.md#the-standard)).
- **Package preset**: the preset a sibling package contributes beside it, such as `test()` from `@jterrazz/test`.
- **Derived file**: a file at the root an editor reads, whose whole content the declaration decides: `oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json` ([Quality checks § The Config pass](quality-checks.md#the-config-one-file-pass)).
- **Law**: what a preset holds every project to and no project's settings write over: its layers, its name rules, the keys of its `lawSettings`. A project sets one aside only in the open, under `optOuts`, with its reason ([Configuration § Setting a law aside](configuration.md#setting-a-law-aside)). A **rule** is one check a finding names by its id, such as `names/no-grab-bag-name` or an oxlint rule. The four laws of [Lint presets](lint-presets.md#the-four-laws) are another use of the word: the principles every decision of the rulebook follows.
- **Config preset**: a file a tool's own config extends rather than a preset: the tsconfig presets (`@jterrazz/typescript/tsconfig/node` and the others), and the knip preset the command derives knip's config from. [Lint presets](lint-presets.md) is the rulebook the profiles carry.

## The project's tree

- **Ground**: the folders a test stands on rather than code: `__fixtures__/`, `__expected__/`, `__seeds__/` and `__requests__/`, wherever they sit. The linter, the formatter, knip and tsc leave them out ([Lint presets § Unused code](lint-presets.md#unused-code-knip)).
- **Specimen**: a small project per kind under this package's `specs/kinds/<kind>/`, into which the specs install the packed packages to prove that kind's gestures ([Configuration § Kind and platform](configuration.md#kind-and-platform)).

## The two shapes

- **The manual's shape**: the sections every repository's `docs/` is cut into, and the pages each one holds ([Quality checks § The Docs pass](quality-checks.md#the-docs-layout-pass)).
- **The root spine**: the folders a repository root may hold without declaring them ([Quality checks § The root spine](quality-checks.md#the-root-spine)).
