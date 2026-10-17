# The ideas

Four ideas carry the whole toolchain. Each one removes a choice a project would otherwise make on its own, and drift on from there.

- **A declaration.** A project says what it is, its kind (`library`, `api`, `cli`, `website` or `mobile`), and what it runs on, its platform (`node`, `bun`, `react`, `next`, `astro` or `expo`). The lint profile, the tsconfig preset, the laws and the checks follow from those two words. A monorepo is no kind: it is the repository's shape, read from the `workspaces` npm already owns, and its root declares nothing; each member declares itself ([Getting started](../start/getting-started.md#1-declare-what-the-project-is)). The words are told apart in [the glossary](../reference/glossary.md#declaration-profiles-and-presets).
- **The settings file.** `jterrazz.config.ts` is the one settings file of the `@jterrazz` family. It holds the repository's settings and, wherever the folder is a project, its declaration, the presets of the sibling packages the project uses, such as `@jterrazz/test`'s, and every setting of every tool, each with its reason. The files an editor reads at the root (`oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json`) are derived from it, and no other tool keeps a config ([Configuration](../reference/configuration.md)).
- **Two everyday commands.** `typescript check` runs every quality pass in parallel and fails on any finding, each printed with what was found, why it matters, how to fix it and the page to read. `typescript fix` repairs whatever can be repaired automatically ([Quality checks](../reference/quality-checks.md)).
- **A baseline.** When a stricter release lands on an existing project, `typescript baseline` records today's debt. From then on each count may only fall ([Adopt a stricter release](../guides/adopt-a-stricter-release.md#the-two-gestures)).

Why one toolchain at all, rather than each project's own wiring, is the [README](../../README.md#why-it-exists)'s.
