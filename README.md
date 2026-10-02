# @jterrazz/typescript

The whole TypeScript toolchain of a project in one devDependency: it builds, type-checks, lints and formats, and it judges the repository's shape. A project keeps a one-line `tsconfig.json`, three small config files that `check` can also supply itself, a `Makefile` and a short manual, and runs two commands, `typescript check` and `typescript fix`. Which of these are required is [Getting started § The shape a consumer keeps](docs/05-getting-started.md#the-shape-a-consumer-keeps); nothing else needs configuring, and nothing needs keeping in sync between projects.

## Why it exists

Every project that wires tsc, a linter, a formatter, a bundler and an unused-code finder by hand ends up with its own opinion of each, and the opinions drift. This package holds one rulebook, where every rule of every plugin it loads is decided by name. Every project gets the same answer, and a stricter release reaches all of them through one version bump.

The work itself runs in fast native tools wherever one exists: [Oxc](https://oxc.rs) and [Rolldown](https://rolldown.rs) through [tsdown](https://tsdown.dev) for the build, the TypeScript 7 Go compiler for types, [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for lint and format, [Knip](https://knip.dev) for unused code, and a few more for packaging, layers, Markdown and names.

## The ideas to hold

- **A profile.** A project names one of six profiles, `node`, `next`, `astro`, `expo`, `bun` or `react`, and the tsconfig preset that goes with it. The profile decides which lint rules apply ([Lint presets](docs/08-lint-presets.md#the-profiles)). A profile is not a preset: the words are told apart in [the manual's map](docs/README.md#the-words-of-this-manual).
- **The settings file.** `jterrazz.config.ts` is the one settings file of the `@jterrazz` family. It lists the presets the project is held to: the base `typescript()` preset always, and the preset of any sibling package it uses, such as `@jterrazz/test`'s ([Configuration](docs/06-configuration.md)).
- **Two everyday commands.** `typescript check` runs every quality pass in parallel and fails on any finding, each printed with what was found, why it matters, how to fix it and the chapter to read. `typescript fix` repairs whatever can be repaired automatically ([Quality checks](docs/07-quality-checks.md)).
- **A baseline.** When a stricter release lands on an existing project, `typescript baseline` records today's debt. From then on each count may only fall ([Operating § Adopting a stricter release](docs/04-operating.md#adopting-a-stricter-release)).

## Start here

```bash
npm install @jterrazz/typescript --save-dev
```

What it needs from the machine — a Node version, a package manager, git — is [Getting started § Before you start](docs/05-getting-started.md#before-you-start). Then follow [Getting started](docs/05-getting-started.md): pick a profile, write three short config files, wire the scripts and the `Makefile`, and run `npx typescript check`. Every file it shows is complete as written.

## The commands

```bash
npx typescript build           # Build an application (ESM + types)
npx typescript bundle          # Bundle a library (ESM + CJS + types)
npx typescript start           # Run the built application
npx typescript dev             # Build, run, and rebuild on changes
npx typescript check           # Every quality pass, in parallel, ending on a drift report
npx typescript fix             # Rewrite in place: lint, formatting, the .gitignore, spellings, fallen baseline counts
npx typescript doctor          # Installed tool versions against the ranges this release declares
npx typescript baseline        # Record today's debt so that it may only fall
npx typescript docs-layout .   # Check a repository's docs/ against the docs spine
npx typescript clean           # Remove .artifacts/ (dist/ stays: it is the product)
npx typescript tsc             # The TypeScript 7 compiler, passed through
```

`check` and `fix` are the two a project runs every day; the rest build, run, or adopt a release. Their flags, what each command exits with, and why `fix` runs on a committed tree are [Quality checks § Flags and exit codes](docs/07-quality-checks.md#flags-and-exit-codes).

## Documentation

The manual lives in [`docs/`](docs/README.md), which opens on a map of its chapters and the order to read them in. The package ships it, so a project that installed the toolchain reads it at `node_modules/@jterrazz/typescript/docs/`. The [`jterrazz-typescript`](https://github.com/jterrazz/package-typescript/blob/main/skills/jterrazz-typescript/SKILL.md) Claude Code skill routes an agent into the right chapter. The API is the types.

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
