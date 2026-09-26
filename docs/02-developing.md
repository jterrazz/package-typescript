# Developing

Install `@jterrazz/typescript` and point three config files at its presets — the toolchain is zero-config beyond that.

```bash
npm install @jterrazz/typescript --save-dev
```

Two audiences read this chapter: a project being wired onto the toolchain, first, and then anyone changing the toolchain itself — the last section is theirs.

## 1. Pick a profile

A project names ONE lint profile, and the tsconfig preset beside it follows from the same choice. There are six profiles and six tsconfig presets, and they differ in one place each way: `bun` sits on the node compiler settings, and a package published to a registry lints as `node` but compiles under `library`.

| Profile | For                                | `extends` in `tsconfig.json`            |
| ------- | ---------------------------------- | --------------------------------------- |
| `node`  | services and command-line tools    | `@jterrazz/typescript/tsconfig/node`    |
| `node`  | a package published to a registry  | `@jterrazz/typescript/tsconfig/library` |
| `next`  | a Next.js application              | `@jterrazz/typescript/tsconfig/next`    |
| `astro` | an Astro site                      | `@jterrazz/typescript/tsconfig/astro`   |
| `expo`  | an Expo / React Native application | `@jterrazz/typescript/tsconfig/expo`    |
| `bun`   | a project on the Bun runtime       | `@jterrazz/typescript/tsconfig/node`    |
| `react` | React with no framework under it   | `@jterrazz/typescript/tsconfig/react`   |

A published package has no lint profile of its own because it would hold no rule of its own: what it adds is its tsconfig preset and its build preset, and the rulebook is `node`'s.

```json
{ "extends": "@jterrazz/typescript/tsconfig/node" }
```

That line is the whole file. Every preset scopes its `include` and `exclude` to `${configDir}` — the directory of the `tsconfig.json` that extends it — so a project inherits the right file set without restating one.

**The `astro` preset stands on Astro's own.** It extends `astro/tsconfigs/strict` first — the file set Astro's tooling needs, `.astro/types.d.ts` included — and then states ours on top, so the strict flags, the React JSX runtime and the ground `exclude` are the ones that hold. The consumer still writes one line:

```json
{ "extends": "@jterrazz/typescript/tsconfig/astro" }
```

`astro` is the consumer's dependency, never this package's: an Astro site already installs it, and the preset's `extends` resolves it from the consumer's `node_modules`.

`node` keeps `allowJs` on and `library` turns it off, and the split is deliberate: a service may still carry a `.js` file — the rulebook scopes decisions to `**/*.js` on the strength of it ([Lint presets](07-lint-presets.md)) — while a published package emits its declarations without a type-checker, which cannot be done from JavaScript.

What each profile adds to the rulebook, and why a profile never relaxes it, is [Lint presets](07-lint-presets.md).

## 2. Create the lint and format configs

```ts
// oxlint.config.ts
import { defineConfig, node } from '@jterrazz/typescript/oxlint';

export default defineConfig(node);
```

```ts
// oxfmt.config.ts
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig(base);
```

Swap `node` for the profile you picked — the import name and the profile name are the same word. A project that also uses `@jterrazz/test` composes that package's testing fragment beside the profile, in the same one line ([Lint presets](07-lint-presets.md)).

Each config names `@jterrazz/typescript` and nothing else — the preset and the tool's own `defineConfig` both arrive from it. Importing `defineConfig` from `oxlint` or `oxfmt` directly asks the project to declare those packages as well, which is the shape below refusing to hold.

That form is every profile's, a published package's included: what used to make a published package name `OxlintConfig` in its config files was `isolatedDeclarations` in the tsconfig preset, and that guarantee has moved to where it belongs — see the build presets below.

A project with several public subpaths needs no build config at all: `build` and `bundle` read their entries off the `exports` map ([Building](05-building.md)). A project that owns a `tsdown.config.ts` anyway imports the build preset from the same place, and it ships a declaration so the import is typed rather than `any`:

```ts
// tsdown.config.ts
import bundle from '@jterrazz/typescript/tsdown/bundle.js';

export default bundle;
```

`build` is the application preset, `bundle` the library one — the same two the CLI runs, and `UserConfig` is exported beside each for a project that annotates its own.

**`isolatedDeclarations` is the `bundle` preset's, not the `library` tsconfig's.** What it buys is a declaration emitted without a type-checker, which is a property of the PUBLISHED artefact: `typescript bundle` refuses an export whose type it would have to infer, and `tsc --noEmit` over the repository does not. In the tsconfig it also reached every spec file, where it refused the destructured export a specification hands back (TS9019).

### A subtree on another profile

A workspace whose members share one profile needs one root config. A subtree that IS another shape — a React client inside a Node service — takes a nested `oxlint.config.ts` of its own, which oxlint applies to that subtree. Linter options belong to the root config only, and the root's already turn type information on for the whole tree, so the nested file ships the profile through `nested()`:

```ts
import { compose, defineConfig, nested, react } from '@jterrazz/typescript/oxlint';
import { testing } from '@jterrazz/test/oxlint';

export default defineConfig(nested(compose(react, testing)));
```

## 3. Wire the CLI into package.json

Applications:

```json
{
    "build": "typescript build",
    "start": "typescript start",
    "dev": "typescript dev",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

Libraries (bundle instead of build):

```json
{
    "build": "typescript bundle",
    "lint": "typescript check",
    "lint:fix": "typescript fix"
}
```

A repository that EMITS with project references runs the compiler directly, and names it through the CLI so the version is the toolchain's: `"build": "typescript tsc --build"` ([Building](05-building.md)).

## 4. Answer the six gestures in a Makefile

The repository's root keeps a `Makefile` with a rule for each of the six gestures every repository answers — the flows speak only these, and the Names (tree) pass refuses a repository that misses one ([Quality checks](06-quality-checks.md#the-six-gestures)):

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

A workspace keeps one, at its root; a member owes none. A repository with more than one fixer — `@jterrazz/test`'s beside this one — runs every one of them whatever the one before it said, by the recipe [Quality checks](06-quality-checks.md#the-six-gestures) gives.

## 5. State a setting, where there is one

A repository with nothing to say about the toolchain keeps no settings file. One that has something states it in `jterrazz.config.ts` at its root, one section per package of the family:

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

The file belongs to the whole family, and this package owns it: `defineConfig` types every section a package of the family declares, and `@jterrazz/test` adds its own, `test`. Each package reads its own section and nothing else. The one setting of the `typescript` section is `roots`, the folders a repository keeps beside its spine ([Quality checks](06-quality-checks.md#a-root-beside-the-spine)).

Node loads the file itself, with its types stripped, so it needs no build and no tool beside the toolchain. A missing file is no settings at all; a file that does not load, or holds no settings object, is a finding of the pass that reads it. A workspace member keeps its own beside its `package.json`, for what that member alone declares.

## The shape a consumer keeps

That is the whole contract, and it is meant to stay that size:

- **One devDependency** — `@jterrazz/typescript`. tsc, oxlint, oxfmt, knip and tsdown are its own dependencies and arrive with it; installing one of them directly gives a project two opinions about its own toolchain, and the versions drift apart from there. It holds under npm, pnpm and bun alike, and pnpm is the one that proves it: its `node_modules` resolves only what the project itself declares, so a config naming any other package would fail there with `ERR_MODULE_NOT_FOUND`.
- **Two commands** — `typescript check` and `typescript fix`. Every gate is behind them, so a script that calls a tool underneath skips the passes the CLI orchestrates.
- **Six gestures** — the `Makefile` rules above, the one door a reader who has never opened the repository knows.
- **One line of tsconfig** — the `extends` above, and nothing beside it. In a workspace that is one line per member: the unit the toolchain measures from is the package, not the repository ([Quality checks](06-quality-checks.md)).

A local `compilerOption` is a **smell, not a shortcut**. It says the preset lacks something, and it settles that lack for one project in a place nobody else reads — so the next project rediscovers the same gap and answers it differently. Name what is missing and change the preset instead: the fix belongs upstream, where every project gets the same answer.

## Where a tool's output goes

Every build, test and lint artefact lives under `.artifacts/<tool>/` at the project root — one folder per tool that writes, `.artifacts/tsc/` for the incremental buildinfo, `.artifacts/vitest/coverage/` for coverage, and so on. Coverage is the runner's output, so it takes the runner's folder and no other: `@jterrazz/test`'s vitest preset sets `coverage.reportsDirectory` there, and the artefact gate names the same path, so a project has one coverage directory rather than two. One directory to ignore, one to delete, and no tool's droppings beside the source.

`dist` is the one exception: a build's **product** stays beside `src/` and is published from there ([Building](05-building.md)). It is not an artefact — it is what the package ships.

Two lines carry the convention into a project:

```bash
echo '.artifacts/' >> .gitignore   # or let `typescript fix` write it
typescript clean                   # rm -rf .artifacts — dist/ is left alone
```

The presets do the rest. Every tsconfig preset compiles incrementally and put the buildinfo at `${configDir}/.artifacts/tsc/tsconfig.tsbuildinfo`, so a warm type-check is several times faster and nothing lands at the project root. In a workspace each member writes under its own root, because `${configDir}` means "the project extending me".

`typescript check` guards it: the [Gitignore (artefacts)](06-quality-checks.md) pass fails a `.gitignore` that still names an artefact somewhere else, and `typescript fix` rewrites it. In a workspace it reads the package's own `.gitignore` AND the nearest ancestor one above it — a workspace root that ignores `.artifacts/` covers every member, even one with no `.gitignore` of its own.

The exceptions the gate never touches — a closed list, plus `.next` under one condition — are [the pass's own chapter](06-quality-checks.md#the-closed-exception-list)'s.

## Conventions

- Entry point is `src/index.ts` — the single public barrel.
- Use `.js` extensions in relative imports: `import { foo } from './bar.js'`.
- The API is the types: a public export's signature is its documentation, and no generated reference sits beside it.

## Taking a bump

Two commands exist for the day a stricter release lands, and both are read-only until you ask for a file:

```bash
typescript doctor     # every tool, what is installed, and the range this release asks for
typescript baseline   # record today's diagnostics, so the count may only fall
```

`doctor` is the first read after a bump: one row per tool, with a verdict. `baseline` is only needed where the bump lands red — it writes the `typescript` section of `jterrazz.baseline.json` from the linter's diagnostics, the Names (tree) pass's and the Comments (density) pass's, and from then on the pass that owns each entry — the oxlint pass, the Names pass, the Comments pass — refuses any rule going up, refuses a rule nobody recorded, and refuses an entry that has reached zero. The `jterrazz(*)` rules and the conventions checker's findings are `@jterrazz/test`'s debt, recorded in the same file's `test` section by its own command. When to reach for each is [Operating](04-operating.md)'s; what the ratchet refuses is [Quality checks](06-quality-checks.md)'s.

## Working on this package

| Gesture        | Runs                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `make install` | `npm ci`, once per change of the lockfile                                                                      |
| `make build`   | nothing to build — the package ships JS directly                                                               |
| `make lint`    | this package's own CLI, `typescript check`, run on this package                                                |
| `make fix`     | `@jterrazz/test`'s checker, then `typescript fix`, each whatever the other said                                |
| `make test`    | the two vitest suites ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md)) |
| `make check`   | `make lint`, then `make test` — the gate before a commit                                                       |

A spec that asserts on some passes of `check` or `fix` runs those alone, through an internal selector this checkout holds and the package does not; what it reads and how the specs reach it is [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for)'s. A chain runs the command as `SELECTING_BIN` and names its passes through `onlyPasses()`, both in `specs/cli/check-passes.ts`.

Every directory a `cli` spec creates sits under one temp root per run: `specs/cli/run-temp-root.ts` creates it under `/tmp`, points `TMPDIR` at it before the first worker starts, and removes it when the run ends. It stays out of a per-user temp folder, whose size slows every tool that walks up from its working directory for a config. A chain takes its scratch directories from `specs/cli/temporary-directory.ts`: `temporaryDirectory()` removes one when the test finishes, and `newDirectory()` leaves one a whole file shares to that file's `afterAll`; a stray one goes with the root. The module tests of the `unit` project create theirs under the system's temp folder and remove them themselves: that project has no root. An install script names `TMPDIR` in its `mktemp` template, since macOS `mktemp` ignores the variable. The product's own `mktemp` scratch directories stay in the system temp folder, and the command removes them on exit.

Where a new thing goes follows the layers ([Architecture](01-architecture.md)): a new gate is a node script in `lint/checks/`, the lines in `bin/commands/check.sh` that decide whether it applies, and its `checker` row in `lint/catalogue/manifest.json`, the manifest [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md#who-a-rule-is-for) describes; a lint decision is a line of a fragment under `lint/`, never a config; a refusal a shipped module or script makes — a throw, a rejection, an exit with anything but 0 — is a `runtime` row of that manifest; a new configuration is a file under `src/presets/`; a new importable entry is a `.js` and a hand-written `.d.ts` in `src/`, an `exports` subpath, and a row in the resolution test.

One standing rule binds every change here: **a change to the public surface reaches three places.** `README.md`, the chapter that owns the subject, and `skills/jterrazz-typescript/SKILL.md`, which routes into the chapter and never restates it — and the Markdown (prose) pass fails a skill naming a chapter that does not exist.

## Related

- [Architecture](01-architecture.md) — the layers a change lands in.
- [Building](05-building.md) — build, bundle, start, dev.
- [Quality checks](06-quality-checks.md) — `check` / `fix`.
- [Repo structure](08-repo-structure.md) — how a repo is organized.
