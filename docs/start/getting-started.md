# Getting started

From an empty folder to a green `typescript check`: one install, one declaration, three derived files, the scripts, a `Makefile` and a small manual. Every file below is complete as written.

## Before you start

- **Node 24 or later.** Node loads `jterrazz.config.ts` itself, stripping its types, which needs no flag from Node 24 on; the package declares it in `engines`.
- **npm, pnpm or bun.** The package holds under each of them. The examples below are npm's; under pnpm, `npx typescript …` is `pnpm exec typescript …` and `npm ci` is `pnpm install --frozen-lockfile`, and under bun they are `bunx typescript …` and `bun install --frozen-lockfile`. One check is narrower off npm: `typescript doctor` reads `package-lock.json` and `bun.lock` to pin the browser provider to vitest, and says so rather than parsing a `pnpm-lock.yaml` or a `bun.lockb` ([The provider pinned to its runner](../guides/adopt-a-stricter-release.md#the-provider-pinned-to-its-runner)).
- **A git repository.** `git init` before the first run. Every gate reads the files git does not ignore, and the manual and the `Makefile` are asked for only at a repository root, a `.git` beside the project. Outside one, the gates walk the disk and those two are never asked.

```bash
npm install @jterrazz/typescript --save-dev
```

tsc, oxlint, oxfmt, knip, tsdown and Stryker are the package's own dependencies and arrive with it. Never install one of them directly: the project would then hold two opinions of its own toolchain, and their versions drift apart from there. A build not yet published is installed from its checkout by [Install an unreleased build](../guides/install-an-unreleased-build.md).

## 1. Declare what the project is

A project says two things about itself, in `jterrazz.config.ts`, and every law, check and editor file follows from them: its **kind**, what it is, and its **platform**, what it runs on.

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ kind: 'api', platform: 'node' });
```

| Kind      | What it is                                  | Its platforms                       |
| --------- | ------------------------------------------- | ----------------------------------- |
| `library` | a package others import, its `exports` kept | any                                 |
| `api`     | a service answering requests                | `node`, `bun`                       |
| `cli`     | a command, named in `bin`                   | `node`, `bun`                       |
| `website` | a site or web application                   | `react`, `next`, `astro`, `browser` |
| `mobile`  | a mobile application                        | `expo`                              |

A kind describes a project. A monorepo is no kind: it is the repository's shape, read from the `workspaces` of its root `package.json`, and its root declares none ([In a monorepo](#in-a-monorepo)).

Both are closed lists, typed: an editor refuses `{ kind: 'api', platform: 'react' }` as you write it, and the [Config (one file) pass](../reference/quality-checks.md#the-config-one-file-pass) refuses it in `check`. The platform picks the lint profile and the tsconfig preset; the kind picks what the manifest must hold — a library its `exports`, a cli its `bin`, an application (`api`, `website`, `mobile`) `"private": true`. What each profile adds to the rulebook is [Lint presets](../reference/lint-presets.md#the-profiles)'s; what each tsconfig preset settles is [Configuration](../reference/configuration.md#the-tsconfig-presets)'s.

The `node` and `bun` presets type Node's own API, so a project on either installs those types beside the toolchain; without them the TypeScript Check pass fails on `Cannot find type definition file for 'node'`:

```bash
npm install @types/node --save-dev
```

## 2. The editor files are derived

An editor reads its tools' configs from fixed names at the root, so three files stay there — and each is what the declaration derives, never a place to configure anything:

```ts
// oxlint.config.ts
import { oxlintConfig } from '@jterrazz/typescript/oxlint';

export default await oxlintConfig(import.meta.url);
```

```ts
// oxfmt.config.ts
import { oxfmtConfig } from '@jterrazz/typescript/oxfmt';

export default await oxfmtConfig(import.meta.url);
```

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }
```

The `tsconfig.json` names the preset of the platform — `node` for `bun`, the platform's own for the others — and the root of a monorepo keeps none, its members each keeping theirs. `typescript fix` writes all three, and `check` refuses one that says anything else (`config/editor-file-derived`): the content is the toolchain's, so a project changes its lint rules, its format or its build through `jterrazz.config.ts`, where every setting carries its reason ([Configuration](../reference/configuration.md)). Each config passes its own directory, so the `jterrazz.config.ts` beside it is the one read wherever the tool starts — a terminal in `src/` included; an editor is opened on the project itself, since oxlint refuses a type-aware config it finds nested below the folder it starts in ([Quality checks § The derived files](../reference/quality-checks.md#the-derived-files)).

No other tool config belongs at the root: knip, the build and mutation testing are configured by the command that runs them, from the same file, and a `knip.json`, a `tsdown.config.ts` or a `stryker.config.json` is refused (`config/no-tool-config`).

A project using `@jterrazz/test` lists its preset, `presets: [test()]`, and its lint rules and checks join the toolchain's. Everything else the settings file can say is [Configuration](../reference/configuration.md)'s.

## 3. Wire the CLI into package.json

Every config file above is an ES module, so `package.json` says `"type": "module"`; without it Node warns on every file it loads, and the tools reading one print it. An application is `"private": true` and keeps no `main`: `npm init` writes a `main` and no `private`, and a package that is not private is judged as one the registry would publish, by the [Publish pass](../reference/quality-checks.md#the-publish-packaging-pass) and the manual of step 5.

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

`build` compiles what the manifest publishes — the `exports`, `main` and `bin` targets, each from its source — and a `.cjs` target gets a CommonJS output beside the ESM one, so a library and an application build with the same command. A library and a cli drop `"private": true` and `start`/`dev`: both commands run `dist/index.js`, which a cli whose only target is its `bin` never builds, so a cli is run as its users run it, `node dist/greet.js` ([Building](../reference/building.md)).

What the build produces, and how it reads the entries, is [Building](../reference/building.md).

`test` runs the project's own test runner: the toolchain ships none. The scripts above use vitest, which `@jterrazz/test` builds on, installed beside it with `npm install vitest --save-dev`; `--passWithNoTests` keeps an empty project green until its first test lands, and goes then.

### With `@jterrazz/test`, or without it

`@jterrazz/test` is optional. Without it, its conventions never run, a `specs/` folder is judged only by the gates every folder is, and `make test` runs whatever runner the project chose. With it, the project lists its preset in the settings file, as step 2 shows, and `typescript check`, `fix` and `baseline` run its checks with their own ([A preset's checks](../reference/quality-checks.md#a-presets-checks)). How to write its specs is [its own manual](https://www.npmjs.com/package/@jterrazz/test).

A project off the preset keeps its own `vitest.config.ts`, if it needs one, and no rule judges it: `config/editor-file-derived` judges that file only when a listed preset derives it, as `test()` does. What [No config of its own](../reference/quality-checks.md#no-config-of-its-own) refuses either way is a second vitest config, a `vitest.<name>.config.ts` or `vitest.workspace.ts`.

## 4. Answer the six gestures in a Makefile

Every repository answers the same six `make` targets at its root, whatever runs under them, so a reader who has never opened it knows how to install, prove and repair it:

```make
.PHONY: install build lint fix test mutation check

install:
	npm ci

build lint test:
	npm run $@

fix:
	npx typescript fix

mutation:
	npx typescript mutation $(MUTATION_ARGS)

check:
	TYPESCRIPT_GATE=$$$$:$(CURDIR) $(MAKE) lint test mutation
```

`TYPESCRIPT_GATE` names the recipe's shell as the gate, so `check` and `mutation` hold the checkout in its name from the first step to the last, and the tests between them run under the same lock ([Quality checks § One gate per checkout](../reference/quality-checks.md#one-gate-per-checkout)).

`check` ends on `mutation`, which reuses of its last report only what the change since leaves standing, and runs cold in CI ([Quality checks § What a report keeps](../reference/quality-checks.md#what-a-report-keeps)); the verdict over the module tests and the whole suite ([Quality checks § Mutation](../reference/quality-checks.md#mutation)): it measures the change not yet committed, or, on a clean tree, the branch since its merge-base with the default branch (the last commit, on the default branch itself), and prints that range in its verdict. `mutation` is no seventh gesture: it is a helper target `check` runs, written so a session can run the verdict alone, and `names/makefile-answers-every-gesture` asks for none. Three cases add a line:

- **A library** reads its build in both other gates — the Publish pass judges what `dist/` would ship, and a spec of the published package packs it — so its `Makefile` adds `lint test: build`, which builds first whatever the order the gestures run in.
- **Any kind whose specs run `dist/`** — an application's built entry driven from a `specs/cli/` tree, a website's built server — adds `test: build`, so the gate builds before its specs spawn what they read; a spec that rebuilds the output itself pays the build once per file.
- **A mobile app** is bundled by its framework, so its `build` is `npx expo export`, never `typescript build`, which builds nothing for that kind ([Building](../reference/building.md#the-entries)).

The `Makefile` is a gate of its own: in a repository, `check` refuses a root with no `Makefile` (`names/repository-has-makefile`) and one with no rule for any of the six (`names/makefile-answers-every-gesture`). A workspace keeps one, at its root; a member owes none. `@jterrazz/test`'s fixers run inside `typescript fix`, so its preset changes nothing here; a repository with a fixer of its own outside the toolchain chains it by the recipe [Quality checks § The six gestures](../reference/quality-checks.md#the-six-gestures) shows.

## 5. Run the gate

```bash
npx typescript fix     # formats, sorts package.json, writes .artifacts/ into the .gitignore
npx typescript check   # every pass, in parallel, then the drift report
```

In a repository, `check` also asks for the shape every repository of the family keeps: a manual under `docs/` and a root `AGENTS.md` that routes to it. The smallest manual that passes is a map and the three pages every manual holds:

```text
AGENTS.md                  # links docs/README.md
docs/README.md             # one row per page
docs/concepts/architecture.md
docs/guides/develop.md
docs/guides/test.md
```

A repository that ships — a `package.json` not marked `"private": true`, such as a library, or a `Dockerfile` — also writes `docs/guides/release.md`. What the shape asks of each page is the [Docs (layout) pass](../reference/quality-checks.md#the-docs-layout-pass)'s. Once it is there, the run ends green:

```text
 RUN  TypeScript Check
✓ Passed (2.1s)
 …
 RUN  Secrets (credentials)
✓ Passed (0.4s)

 DRIFT  Deviations from the profile
  declared                              api on node
  rules off vs profile                  none
  suppressions                          0
  .jterrazz/oxlint-suppressions.json    nothing held
  .jterrazz/baseline.json › typescript  nothing held
  tool versions                         in range

✓ All checks passed
```

A failing pass prints its whole log, each finding in four parts: what was found, why it matters, how to fix it, and the page to read. Every pass and every rule id is in [Quality checks](../reference/quality-checks.md).

## What the first check asks of the tree

Beyond the files above, `check` judges what the project already holds. On an empty project nothing of it fires; on a project with code, these are the findings a first run usually lands:

- **Names.** A folder or file named `utils`, `helpers`, `common`, `types.ts`, an abbreviation such as `auth` or `cfg`: [the three rosters](../reference/quality-checks.md#the-names-tree-pass).
- **Root folders.** A root folder off [the root spine](../reference/quality-checks.md#the-root-spine), such as `scripts/`, `test/` or `docker/`, is declared with its reason: [A root beside the spine](../reference/quality-checks.md#a-root-beside-the-spine).
- **Comments.** Every comment opens with the kind of thing it states, and an old tree records the ones it holds with `typescript baseline`: [A comment states its kind](../reference/lint-presets.md#a-comment-states-its-kind).
- **Prose.** Every Markdown page, the README included, keeps its links resolving and its paragraphs within twelve lines: [the Markdown pass](../reference/quality-checks.md#the-markdown-prose-pass).
- **Secrets.** A file carrying a live-looking credential: [the Secrets pass](../reference/quality-checks.md#the-secrets-credentials-pass).
- **Unused code.** An export, a file or a dependency nothing uses: [knip](../reference/lint-presets.md#unused-code-knip).
- **The manual and the `Makefile`**, at a repository root: steps 4 and 5 above.

## The shape a consumer keeps

That is the whole contract, and it is meant to stay that size:

- **One devDependency**, `@jterrazz/typescript`.
- **Two commands**, `typescript check` and `typescript fix`. Every gate sits behind them, so a script calling a tool underneath skips the passes the command orchestrates.
- **One file of settings**, `jterrazz.config.ts`: the kind, the platform, the presets, and every setting with its reason.
- **Three derived files**, `oxlint.config.ts`, `oxfmt.config.ts` and `tsconfig.json`, each written by `fix` and refused by `check` when it says anything else. In a monorepo the `tsconfig.json` is one per member: the toolchain measures from the package, not the repository.
- **Two tracked ledgers at most**, under `.jterrazz/`: the debt the ratchet holds, gone when it is paid ([the ratchet](../reference/quality-checks.md#the-ratchet)).
- **Six gestures**, the `Makefile` above, and **a manual**, `AGENTS.md` and `docs/`: both required at a repository root.

A local `compilerOption` is written under `typescript.tsconfig`, with its reason, and lands in the derived `tsconfig.json`; it is still a smell rather than a shortcut. It says the preset lacks something, and settles that lack for one project where nobody else reads it, so the next project meets the same gap and answers it differently. Change the preset instead, where every project gets the answer.

## Where a tool's output goes

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root: `.artifacts/tsc/` for the incremental build info, `.artifacts/vitest/` for the test cache and coverage, `.artifacts/stryker/` for mutation runs, `.artifacts/dev/` for the scripts a repository builds for itself — one folder per tool that writes, all of it regenerable. One directory to ignore, one to delete, and nothing beside the source.

A cache with no place to point it is turned off rather than left elsewhere: the command runs its tools with jiti's transpile cache off, so knip reading a `vitest.config.ts` writes nothing under `node_modules/.cache/`.

`dist/` is the one exception. It is a build's product, published from beside `src/`, not an artefact.

```bash
typescript clean   # removes .artifacts/ and leaves dist/ alone
```

The presets already write there, and the [Gitignore (artefacts) pass](../reference/quality-checks.md#the-gitignore-artefacts-pass) fails a `.gitignore` that still names an artefact anywhere else; `typescript fix` rewrites it.

## Your editor

Open the editor on the project folder, a workspace on its root, never on a folder above it: oxlint started above the project reads the derived config as a nested one and lints with its own defaults ([Quality checks § The derived files](../reference/quality-checks.md#the-derived-files)).

- **Lint and format.** An Oxc integration — the Oxc extension in VS Code and its forks — runs `oxlint --lsp` and `oxfmt --lsp`; point it at the project's own `node_modules/.bin/oxlint` and `oxfmt`, so the editor runs the versions `check` runs. The type-aware rules need nothing more: oxlint finds `tsgolint` in the same `node_modules/.bin`. Turn off any ESLint or Prettier integration for the project, which would judge it by another rulebook.
- **Types.** `check` type-checks with the TypeScript 7 compiler this package installs, at `node_modules/@typescript/typescript-<os>-<arch>/lib/tsc`, whose language server is `tsc --lsp --stdio`. Point the editor's TypeScript at it. `node_modules/typescript` is TypeScript 6, kept for two tools that read its JavaScript API ([Architecture](../concepts/architecture.md#two-typescript-compilers-on-purpose)); an editor told to use the workspace version picks that one, and can then disagree with `check`, which stays the verdict.
- **After an edit of `jterrazz.config.ts`**, save `oxlint.config.ts` or restart the oxlint server: it watches its own config, not the declaration.

## In a monorepo

A repository is a monorepo when its root `package.json` lists `workspaces` — npm owns that fact, and nothing declares it again. The root is a container, never a project: its manifest is `"private": true`, and it declares no kind and no platform. Each member declares its own beside its `package.json`. The root's `jterrazz.config.ts`, when it has one, holds the repository's settings alone — its roots, its oxfmt and oxlint ignores and overrides, its knip entries, its presets — and a root with none of those keeps no file:

```ts
// jterrazz.config.ts, at the root — only when the repository has settings of its own
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

```ts
// packages/greeting/jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ kind: 'library', platform: 'node' });
```

```text
package.json            # "private": true, "workspaces": ["packages/*"]
jterrazz.config.ts      # the repository's settings, no kind — or no file at all
oxlint.config.ts        # derived; lints each member by its own declaration
oxfmt.config.ts         # derived
Makefile                # the six gestures, once for the repository
AGENTS.md, docs/        # the manual, once for the repository
.jterrazz/              # the ledgers, where check runs
packages/greeting/
  package.json
  jterrazz.config.ts    # { kind: 'library', platform: 'node' }
  tsconfig.json         # derived from the member's platform
  src/
```

A kind at the root, or a root npm would publish, is refused by `config/kind-matches-manifest`. The root keeps no `tsconfig.json`, and a member keeps no `oxlint.config.ts`, `oxfmt.config.ts` or `Makefile`. `typescript check` and `fix` run at the root: which passes run once per member and which once for the tree is [Quality checks § In a monorepo](../reference/quality-checks.md#in-a-monorepo), and a member's knip paths carry its folder ([Lint presets § Workspaces](../reference/lint-presets.md#workspaces)).

## A repository with no code

A repository with no code of the toolchain's — YAML, Markdown, an infrastructure, a vault of articles, an application in another language — declares itself in a `jterrazz.config.ts` and keeps no `package.json`:

```ts
// jterrazz.config.ts
export default { kind: 'content' };
```

The file imports nothing: it is a plain object, so nothing needs installing for it to load. `typescript check` then judges what means something there — the declaration, the `.artifacts/` ignore, the manual's layout, the comments, the Markdown, the names it declares and its empty folders, and the secrets — and runs no TypeScript, linter, formatter or unused-code pass. Which passes, and why each, is [Quality checks § A repository with no code](../reference/quality-checks.md#a-repository-with-no-code). Run it with `npx --yes --package=@jterrazz/typescript -- typescript check`, from a `make lint` or a workflow.

## On an existing project

A project that already has code usually lands red on its first `check`. Two commands make that day short: `typescript doctor` compares the installed tools with what this release expects, and `typescript baseline` records today's findings so that each count may only fall from then on. When to reach for each is [Adopt a stricter release](../guides/adopt-a-stricter-release.md#the-two-gestures).
