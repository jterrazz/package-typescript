# @jterrazz/typescript

The whole TypeScript toolchain of a project in one devDependency: it builds, type-checks, lints and formats, and it judges the repository's shape. A project keeps one settings file, `jterrazz.config.ts`, that says what it is; the editor files derived from it (`tsconfig.json`, `oxlint.config.ts`, `oxfmt.config.ts`), which `typescript fix` writes and `typescript check` holds to their derived content; a `Makefile` and a short manual. It runs two commands, `typescript check` and `typescript fix`. Nothing else needs configuring, and nothing needs keeping in sync between projects.

## Why it exists

Every project that wires tsc, a linter, a formatter, a bundler and an unused-code finder by hand ends up with its own opinion of each, and the opinions drift. This package holds one rulebook, where every rule of every plugin it loads is decided by name. Every project gets the same answer, and a stricter release reaches all of them through one version bump.

The work itself runs in fast native tools wherever one exists: [Oxc](https://oxc.rs) and [Rolldown](https://rolldown.rs) through [tsdown](https://tsdown.dev) for the build, the TypeScript 7 Go compiler for types, [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for lint and format, [Knip](https://knip.dev) for unused code, and a few more for packaging, layers, Markdown and names.

## In 30 seconds

Requires Node 24 or later, and npm, pnpm or bun.

```bash
npm install @jterrazz/typescript @types/node --save-dev
```

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ kind: 'api', platform: 'node' });
```

```bash
npx typescript fix     # writes tsconfig.json, oxlint.config.ts and oxfmt.config.ts from the declaration
npx typescript check   # every quality pass, in parallel; each finding names what, why, how to fix, and the page to read
```

A project carries `"type": "module"` in its `package.json`. In a git repository `check` also asks for a `Makefile` and a manual; [Getting started](docs/start/getting-started.md) takes a project the whole way, every file complete as written.

Before a release is tagged, `npx typescript rehearse` runs the gate on Linux, in Docker, on a fresh clone of the branch, as the GitHub runner that publishes it will ([Commands](docs/reference/commands.md#a-rehearsal-on-linux)).

## Documentation

The manual lives in [`docs/`](docs/README.md), which opens on a map of its pages: a tutorial to start, guides for a task, concepts for the why, and a reference to look a pass, a rule or a setting up. The package ships it, so a project that installed the toolchain reads it at `node_modules/@jterrazz/typescript/docs/`. The [`jterrazz-typescript`](https://github.com/jterrazz/package-typescript/blob/main/skills/jterrazz-typescript/SKILL.md) Claude Code skill routes an agent into the right page. The API is the types.

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
