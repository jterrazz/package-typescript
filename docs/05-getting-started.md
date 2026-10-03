# Getting started

From an empty folder to a green `typescript check`: one install, one declaration, three derived lines, the scripts, a `Makefile` and a small manual. Every file below is complete as written.

## Before you start

- **Node 24 or later.** Node loads `jterrazz.config.ts` itself, stripping its types, which needs no flag from Node 24 on; the package declares it in `engines`.
- **npm, pnpm or bun.** The package holds under each of them.
- **A git repository.** `git init` before the first run. Every gate reads the files git does not ignore, and the manual and the `Makefile` are asked for only at a repository root, a `.git` beside the project. Outside one, the gates walk the disk and those two are never asked.

```bash
npm install @jterrazz/typescript --save-dev
```

tsc, oxlint, oxfmt, knip, tsdown and Stryker are the package's own dependencies and arrive with it. Never install one of them directly: the project would then hold two opinions of its own toolchain, and their versions drift apart from there.

## 1. Declare what the project is

A project says two things about itself, in `jterrazz.config.ts`, and every law, check and editor file follows from them: its **kind**, what it is, and its **platform**, what it runs on.

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ kind: 'api', platform: 'node' });
```

| Kind        | What it is                                  | Its platforms                                         |
| ----------- | ------------------------------------------- | ----------------------------------------------------- |
| `library`   | a package others import, its `exports` kept | any                                                   |
| `api`       | a service answering requests                | `node`, `bun`                                         |
| `cli`       | a command, named in `bin`                   | `node`, `bun`                                         |
| `website`   | a site or web application                   | `react`, `next`, `astro`                              |
| `mobile`    | a mobile application                        | `expo`                                                |
| `workspace` | the root of a monorepo                      | none — each member declares its own kind and platform |

Both are closed lists, typed: an editor refuses `{ kind: 'api', platform: 'react' }` as you write it, and the [Config (one file) pass](07-quality-checks.md#the-config-one-file-pass) refuses it in `check`. The platform picks the lint profile and the tsconfig preset; the kind picks what the manifest must hold — a library its `exports`, a cli its `bin`. What each profile adds to the rulebook is [Lint presets](08-lint-presets.md#the-profiles)'s; what each tsconfig preset settles is [Configuration](06-configuration.md#the-tsconfig-presets)'s.

The `node` and `bun` presets type Node's own API, so a project on either installs those types beside the toolchain; without them the TypeScript Check pass fails on `Cannot find type definition file for 'node'`:

```bash
npm install @types/node --save-dev
```

## 2. The editor files are derived

An editor reads its tools' configs from fixed names at the root, so three files stay there — and each is a line the declaration derives, never a place to configure anything:

```ts
// oxlint.config.ts
export { default } from '@jterrazz/typescript/oxlint';
```

```ts
// oxfmt.config.ts
export { default } from '@jterrazz/typescript/oxfmt';
```

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }
```

The `tsconfig.json` names the preset of the platform — `node` for `bun`, the platform's own for the others — and a `workspace` keeps none at its root, its members each keeping theirs. `typescript fix` writes all three, and `check` refuses one that says anything else (`config/editor-file-derived`): the content is the toolchain's, so a project changes its lint rules, its format or its build through `jterrazz.config.ts`, where every setting carries its reason ([Configuration](06-configuration.md)). The `oxlint` and `oxfmt` entries read `jterrazz.config.ts` from the directory the tool runs in, which is the project root for `check`, for the oxc language servers an editor starts there, and for a terminal at the root.

No other tool config belongs at the root: knip, the build and mutation testing are configured by the command that runs them, from the same file, and a `knip.json`, a `tsdown.config.ts` or a `stryker.config.json` is refused (`config/no-tool-config`).

A project using `@jterrazz/test` lists its preset, `presets: [test()]`, and its lint rules and checks join the toolchain's. Everything else the settings file can say is [Configuration](06-configuration.md)'s.

## 3. Wire the CLI into package.json

Every config file above is an ES module, so `package.json` says `"type": "module"`; without it Node warns on every file it loads, and the tools reading one print it. An application is `"private": true` and keeps no `main`: `npm init` writes a `main` and no `private`, and a package that is not private is judged as one the registry would publish, by the [Publish pass](07-quality-checks.md#the-publish-packaging-pass) and the docs spine of step 5.

The scripts are the same for every kind:

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

`build` compiles what the manifest publishes — the `exports`, `main` and `bin` targets, each from its source — and a `.cjs` target gets a CommonJS output beside the ESM one, so a library and an application build with the same command. A library drops `"private": true` and `start`/`dev`.

What the build produces, and how it reads the entries, is [Building](09-building.md).

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
  declared                              api on node
  rules off vs profile                  none
  suppressions                          0
  .jterrazz/oxlint-suppressions.json    nothing held
  .jterrazz/baseline.json › typescript  nothing held
  tool versions                         in range

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
- **One file of settings**, `jterrazz.config.ts`: the kind, the platform, the presets, and every setting with its reason.
- **Three derived lines**, `oxlint.config.ts`, `oxfmt.config.ts` and `tsconfig.json`, each written by `fix` and refused by `check` when it says anything else. In a workspace the `tsconfig.json` is one per member: the toolchain measures from the package, not the repository.
- **Two tracked ledgers at most**, under `.jterrazz/`: the debt the ratchet holds, gone when it is paid ([the ratchet](07-quality-checks.md#the-ratchet)).
- **Six gestures**, the `Makefile` above, and **a manual**, `AGENTS.md` and `docs/`: both required at a repository root.

A local `compilerOption` is written under `typescript.tsconfig`, with its reason, and lands in the derived `tsconfig.json`; it is still a smell rather than a shortcut. It says the preset lacks something, and settles that lack for one project where nobody else reads it, so the next project meets the same gap and answers it differently. Change the preset instead, where every project gets the answer.

## Where a tool's output goes

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root: `.artifacts/tsc/` for the incremental build info, `.artifacts/vitest/` for the test cache and coverage, `.artifacts/stryker/` for mutation runs, `.artifacts/dev/` for the scripts a repository builds for itself — one folder per tool that writes, all of it regenerable. One directory to ignore, one to delete, and nothing beside the source.

`dist/` is the one exception. It is a build's product, published from beside `src/`, not an artefact.

```bash
typescript clean   # removes .artifacts/ and leaves dist/ alone
```

The presets already write there, and the [Gitignore (artefacts) pass](07-quality-checks.md#the-gitignore-artefacts-pass) fails a `.gitignore` that still names an artefact anywhere else; `typescript fix` rewrites it.

## On an existing project

A project that already has code usually lands red on its first `check`. Two commands make that day short: `typescript doctor` compares the installed tools with what this release expects, and `typescript baseline` records today's findings so that each count may only fall from then on. When to reach for each is [Operating § Adopting a stricter release](04-operating.md#adopting-a-stricter-release).
