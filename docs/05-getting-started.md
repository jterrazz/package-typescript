# Getting started

From an empty folder to a green `typescript check`: one install, one profile, three small config files, the scripts, a `Makefile` and a small manual. Every file below is complete as written.

## Before you start

- **Node 24 or later.** Node loads `jterrazz.config.ts` itself, stripping its types, which needs no flag from Node 24 on; the package declares it in `engines`.
- **npm, pnpm or bun.** The package holds under each of them.
- **A git repository.** `git init` before the first run. Every gate reads the files git does not ignore, and the manual and the `Makefile` are asked for only at a repository root, a `.git` beside the project. Outside one, the gates walk the disk and those two are never asked.

```bash
npm install @jterrazz/typescript --save-dev
```

tsc, oxlint, oxfmt, knip and tsdown are the package's own dependencies and arrive with it. Never install one of them directly: the project would then hold two opinions of its own toolchain, and their versions drift apart from there.

## 1. Pick a profile

A project names one profile. It decides which lint rules apply, and the tsconfig preset follows from the same choice:

| Profile | For                                | `extends` in `tsconfig.json`            |
| ------- | ---------------------------------- | --------------------------------------- |
| `node`  | services and command-line tools    | `@jterrazz/typescript/tsconfig/node`    |
| `node`  | a package published to a registry  | `@jterrazz/typescript/tsconfig/library` |
| `next`  | a Next.js application              | `@jterrazz/typescript/tsconfig/next`    |
| `astro` | an Astro site                      | `@jterrazz/typescript/tsconfig/astro`   |
| `expo`  | an Expo / React Native application | `@jterrazz/typescript/tsconfig/expo`    |
| `bun`   | a project on the Bun runtime       | `@jterrazz/typescript/tsconfig/node`    |
| `react` | React with no framework under it   | `@jterrazz/typescript/tsconfig/react`   |

A published package lints as `node` and compiles under `library`: what sets it apart is how it is built, not which rules it keeps.

The `node` and `library` presets type Node's own API, so a project on either installs those types beside the toolchain; without them the TypeScript Check pass fails on `Cannot find type definition file for 'node'`:

```bash
npm install @types/node --save-dev
```

The `tsconfig.json` is one line, and nothing else belongs in it:

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }
```

What each profile adds to the rulebook is [Lint presets](08-lint-presets.md#the-profiles)'s; what each tsconfig preset settles is [Configuration](06-configuration.md#the-tsconfig-presets)'s.

## 2. Write the three config files

The settings file names the profile, through the base preset `typescript()`:

```ts
// jterrazz.config.ts
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({ presets: [typescript({ profile: 'node' })] });
```

The lint config composes what the settings file declares, and names nothing else:

```ts
// oxlint.config.ts
import { defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

export default defineConfig(fromPresets(settings));
```

The format config takes the shared formatting as it is:

```ts
// oxfmt.config.ts
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig(base);
```

Each file imports `@jterrazz/typescript` and nothing else, its tool's `defineConfig` included. Importing `defineConfig` from `oxlint` or `oxfmt` would make the project declare those packages too, and under pnpm, which resolves only what a project declares, the import fails with `ERR_MODULE_NOT_FOUND`.

A project using `@jterrazz/test` lists its preset beside the base one, `presets: [typescript({ profile: 'node' }), test()]`, and the same `fromPresets` line arms its lint rules. Everything else the settings file can say is [Configuration](06-configuration.md)'s.

## 3. Wire the CLI into package.json

Every config file above is an ES module, so `package.json` says `"type": "module"`; without it Node refuses `import` in all three, and every pass that reads one fails. An application is `"private": true` and keeps no `main`: `npm init` writes a `main` and no `private`, and a package that is not private is judged as one the registry would publish, by the [Publish pass](07-quality-checks.md#the-publish-packaging-pass) and the docs spine of step 5.

An application builds with `build`:

```json
{
    "type": "module",
    "private": true,
    "scripts": {
        "build": "typescript build",
        "start": "typescript start",
        "dev": "typescript dev",
        "lint": "typescript check",
        "lint:fix": "typescript fix",
        "test": "vitest --run --passWithNoTests"
    }
}
```

A library builds with `bundle`, which adds a CommonJS output beside the ESM one:

```json
{
    "type": "module",
    "scripts": {
        "build": "typescript bundle",
        "lint": "typescript check",
        "lint:fix": "typescript fix",
        "test": "vitest --run --passWithNoTests"
    }
}
```

What each build command produces, and which entries it compiles, is [Building](09-building.md).

`test` runs the project's own test runner: the toolchain ships none. The scripts above use vitest, which `@jterrazz/test` builds on, installed beside it with `npm install vitest --save-dev`; `--passWithNoTests` keeps an empty project green until its first test lands, and goes then.

### With `@jterrazz/test`, or without it

`@jterrazz/test` is optional. Without it, its conventions never run, a `specs/` folder is judged only by the gates every folder is, and `make test` runs whatever runner the project chose. With it, the project lists its preset in the settings file, as step 2 shows, and `typescript check`, `fix` and `baseline` run its checks with their own ([A preset's checks](07-quality-checks.md#a-presets-checks)). How to write its specs is [its own manual](https://www.npmjs.com/package/@jterrazz/test).

## 4. Answer the six gestures in a Makefile

Every repository answers the same six `make` targets at its root, whatever runs under them, so a reader who has never opened it knows how to install, prove and repair it:

```make
.PHONY: install build lint fix test check

install:
	npm ci

build lint test:
	npm run $@

fix:
	npm run lint:fix

check: lint test
```

The `Makefile` is a gate of its own: in a repository, `check` refuses a root with no `Makefile` (`names/repository-has-makefile`) and one with no rule for any of the six (`names/makefile-answers-every-gesture`). A workspace keeps one, at its root; a member owes none. A repository with a second fixer, `@jterrazz/test`'s, runs both from `fix` by the recipe [Quality checks](07-quality-checks.md#the-six-gestures) gives.

## 5. Run the gate

```bash
npx typescript fix     # formats, sorts package.json, writes .artifacts/ into the .gitignore
npx typescript check   # every pass, in parallel, then the drift report
```

In a repository, `check` also asks for the shape every repository of the family keeps: a manual under `docs/` and a root `AGENTS.md` that routes to it. The smallest manual that passes is a map and the three chapters of the docs spine:

```text
AGENTS.md                  # links docs/README.md
docs/README.md             # one row per chapter
docs/01-architecture.md
docs/02-developing.md
docs/03-testing.md
```

A repository that ships — a `package.json` not marked `"private": true`, such as a library, or a `Dockerfile` — also writes `docs/04-operating.md`. What the docs spine asks of each chapter is the [Docs (layout) pass](07-quality-checks.md#the-docs-layout-pass)'s. Once it is there, the run ends green:

```text
 RUN  TypeScript Check
✓ Passed
 …
 RUN  Secrets (credentials)
✓ Passed

 DRIFT  Deviations from the profile
  profile                              node
  rules off vs profile                 none
  suppressions                         0
  oxlint-suppressions.json             nothing held
  jterrazz.baseline.json › typescript  nothing held
  tool versions                        in range

✓ All checks passed
```

A failing pass prints its whole log, each finding in four parts: what was found, why it matters, how to fix it, and the chapter to read. Every pass and every rule id is in [Quality checks](07-quality-checks.md).

## What the first check asks of the tree

Beyond the files above, `check` judges what the project already holds. On an empty project nothing of it fires; on a project with code, these are the findings a first run usually lands:

- **Names.** A folder or file named `utils`, `helpers`, `common`, `types.ts`, an abbreviation such as `auth` or `cfg`: [the three rosters](07-quality-checks.md#the-names-tree-pass).
- **Root folders.** A root folder off [the root spine](07-quality-checks.md#the-root-spine), such as `scripts/`, `test/` or `docker/`, is declared with its reason: [A root beside the spine](07-quality-checks.md#a-root-beside-the-spine).
- **Comments.** The comment lines are counted, and the count is recorded once with `typescript baseline`: [the Comments pass](07-quality-checks.md#the-comments-density-pass).
- **Prose.** Every Markdown page, the README included, keeps its links resolving and its paragraphs within twelve lines: [the Markdown pass](07-quality-checks.md#the-markdown-prose-pass).
- **Secrets.** A file carrying a live-looking credential: [the Secrets pass](07-quality-checks.md#the-secrets-credentials-pass).
- **Unused code.** An export, a file or a dependency nothing uses: [knip](08-lint-presets.md#unused-code-knip).
- **The manual and the `Makefile`**, at a repository root: steps 4 and 5 above.

## The shape a consumer keeps

That is the whole contract, and it is meant to stay that size:

- **One devDependency**, `@jterrazz/typescript`.
- **Two commands**, `typescript check` and `typescript fix`. Every gate sits behind them, so a script calling a tool underneath skips the passes the command orchestrates.
- **One line of tsconfig**, the `extends`, required: the TypeScript Check pass compiles by it. In a workspace it is one line per member: the toolchain measures from the package, not the repository.
- **Three config files, each optional to `check`.** Where `jterrazz.config.ts` is missing, the project is held to the base preset on the `node` profile; where `oxlint.config.ts` or `oxfmt.config.ts` is, `check` hands the same composition by path. Written out, they say the profile in the open, and they are what a tool run outside `check`, an editor's included, finds.
- **Six gestures**, the `Makefile` above, and **a manual**, `AGENTS.md` and `docs/`: both required at a repository root.

A local `compilerOption` is a smell, not a shortcut. It says the preset lacks something, and settles that lack for one project where nobody else reads it, so the next project meets the same gap and answers it differently. Change the preset instead, where every project gets the answer.

## Where a tool's output goes

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root: `.artifacts/tsc/` for the incremental build info, `.artifacts/vitest/coverage/` for coverage, one folder per tool that writes. One directory to ignore, one to delete, and nothing beside the source.

`dist/` is the one exception. It is a build's product, published from beside `src/`, not an artefact.

```bash
typescript clean   # removes .artifacts/ and leaves dist/ alone
```

The presets already write there, and the [Gitignore (artefacts) pass](07-quality-checks.md#the-gitignore-artefacts-pass) fails a `.gitignore` that still names an artefact anywhere else; `typescript fix` rewrites it.

## On an existing project

A project that already has code usually lands red on its first `check`. Two commands make that day short: `typescript doctor` compares the installed tools with what this release expects, and `typescript baseline` records today's findings so that each count may only fall from then on. When to reach for each is [Operating § Adopting a stricter release](04-operating.md#adopting-a-stricter-release).
