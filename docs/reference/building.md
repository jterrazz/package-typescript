# Building

Three commands cover a project's build and run: `build` produces `dist/`, `start` and `dev` run it. A fourth, `tsc`, passes the compiler through for the one thing they do not do. The pipeline is [tsdown](https://tsdown.dev) over [Rolldown](https://rolldown.rs): it transpiles, bundles and emits the declarations, from a config the command derives and hands over. A project keeps no `tsdown.config.ts`, and the [Config (one file) pass](quality-checks.md#the-config-one-file-pass) refuses one.

| Command            | Produces                                                             | For                                      |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| `typescript build` | what the manifest publishes: ESM, declarations and source maps       | every kind but `mobile`                  |
| `typescript start` | nothing: runs the built `dist/index.js`, with `--enable-source-maps` | an application                           |
| `typescript dev`   | builds, runs, then rebuilds and reruns on every change               | an application                           |
| `typescript tsc`   | whatever the compiler emits                                          | a repository built on project references |

`build --watch` builds the same plan and rebuilds on every change, running nothing: a project whose output another tool reads (an editor extension host, a bundler of a sibling) watches it without starting an application. `start` and `dev` always run `dist/index.js`, the output of `src/index.ts`, and `start` hands it whatever arguments follow, except `-h` and `--help`, which print its usage; after `--`, every argument reaches the application ([Commands § Flags and help](commands.md#flags-and-help)). Neither looks for a `bin`. A project with no `dist/index.js` (a `cli` whose only target is its `bin`, a workspace root that builds nothing itself) has nothing for them to run and Node fails to find the module, so it keeps neither script: a cli is run by its built bin, `node dist/greet.js`, and a workspace runs each member's own.

## The entries

A build compiles what the package publishes, and its `package.json` already says what that is: its `exports`, `main` and `bin`. Each target under `dist/` is compiled from its entry under `src/`, named by [the entry grammar](quality-checks.md#the-entry-grammar), and written where the manifest says:

| Manifest                                                   | Entry                        | Output                  |
| ---------------------------------------------------------- | ---------------------------- | ----------------------- |
| `".": "./dist/index.js"`                                   | `src/index.ts`               | `dist/index.js`         |
| `"./register": "./dist/register.js"`                       | `src/index.register.ts`      | `dist/register.js`      |
| `"./rules": { "browser": "./dist/rules.browser.js", ... }` | `src/index.rules.browser.ts` | `dist/rules.browser.js` |
| `"bin": { "greet": "./dist/greet.js" }`                    | `src/greet.bin.ts`           | `dist/greet.js`         |

A package with no manifest target under `dist/` compiles `src/index.ts`, beside the modules [named for how they are loaded](#what-the-manifest-does-not-name), as an application does. A pattern (`./tsconfig/*`) is skipped, since the map does not enumerate what it stands for. A code target whose entry is on no disk is refused in four parts before anything is built, naming the target and the two places its entry may sit (`src/register.ts` publishes nothing, `src/index.register.ts` does), since a build that skipped it would ship a package whose import of that subpath resolves to nothing.

A `mobile` app builds nothing here: Metro bundles it, through `npx expo export`, and its manifest's `main` names the router's entry, never a module of `dist/`. `typescript build` says so and exits 0, building only the repository's own commands, if it keeps any.

Each target decides its output by its extension and its condition:

- a `.js` target is ESM, with its declarations and source map;
- a `.cjs` target adds a CommonJS output beside the ESM one, for a package loaded by `require`; a manifest that names `.cjs` alone (a `main` with no `module` or `import` beside it) builds CommonJS alone;
- a `browser` condition is built apart, for the browser platform, with no declarations: its `types` are the node build's;
- the rest is built for the platform the project declares: the browser for `react`, `next`, `astro` and `expo`, Node otherwise.

Three more things follow from the manifest. A `library` or a `cli` that is `private` is installed by its own repository and read by no consumer, so its build emits no declarations (an ambient module of its host failed the build of an editor extension). The exception is a sibling member of its workspace that depends on it, which is a consumer: the sibling's type check reads the declarations, so a private library the workspace shares keeps them. A host module typed by `@types/<name>` with no `<name>` package of its own (`vscode` is the case) exists only in the process that loads the extension, so it is left out of the bundle and stays an import. And a `bin` built from `src/<name>.bin.ts` opens on `#!/usr/bin/env node`, which the build adds when the source holds none and leaves where it does.

A module two entries share is written once per step that bundles them, under a name only that step writes: `dist/shared-<name>.js` for the ESM entries, `dist/shared-<name>.cjs` for the CommonJS ones, `dist/bin-shared-<name>.js` for the bins built under the interpreter line, and `dist/browser-shared-<name>.js` for the `browser` conditions. Every step writes into `dist/`, so a name two steps shared would leave one step's entries importing the other's code.

A `library` emits its declarations with the type-checker, so an export with no annotation is published with the type the checker infers for it. An inferred type a consumer could not name, such as one only a dependency of a dependency resolves, fails the build (TS2883) rather than ship a declaration naming it. [ADR-018](../decisions/018-a-project-declares-what-it-is-and-every-config-follows.md#consequences) records why they are not built file by file with `isolatedDeclarations`.

### What the manifest does not name

Two kinds of entry are not in `exports`, `main` or `bin`, and their names say so; nothing is declared:

| Named                                           | Loaded                                                  | Built into                                |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `src/instrumentation.ts`                        | by Node with `--import`, before the app                 | `dist/instrumentation.js`                 |
| `src/**/<name>.worker.ts`                       | by a worker pool, by path                               | `dist/<name>.worker.js`                   |
| `src/**/<name>.global-setup.ts`                 | by vitest, as a global setup a specification hands it   | `dist/<name>.global-setup.js`             |
| `src/**/<name>.cli.ts`, `lint/**/<name>.cli.ts` | by the repository, a command it runs on itself          | `.artifacts/dev/<name>.js`, never shipped |
| `lint/self/<name>.ts`                           | by the repository, the entries of its self-hosting tree | `.artifacts/dev/<name>.js`, never shipped |

The first three ship beside the published entries; the last two are the repository's own scripts and its self preset ([A repository held to its own presets](configuration.md#a-repository-held-to-its-own-presets)), as the modules at the root of `lint/` are the package's. A folder whose name opens on `.` or `_` is not read: a fixture is no entry. Two modules built to one output name are refused in four parts, reading this section; rename one.

## A build that fails

When tsdown stops, its own report is printed as it came, and below it the command's four-part refusal: what failed, why a stale `dist/` matters, what to do, and this section. The command exits 1. Nothing of the partial output is cleaned up; the next build starts by clearing `dist/`. A build the command cannot derive (a settings file that does not resolve, two modules built to one name) is refused before tsdown runs, in the same four parts.

## tsc

`typescript tsc <args...>` runs the TypeScript 7 Go compiler this package ships, with the arguments handed straight to it. It exists for the one thing `check` cannot do, emit, which a repository built on project references does with `"build": "typescript tsc --build"`. Without it, such a repository reaches for whatever `tsc` the tree hoisted onto `PATH`, and can compile against an older TypeScript without noticing.

## Related

- [Getting started](../start/getting-started.md): the scripts that call these commands.
- [Quality checks](quality-checks.md#the-publish-packaging-pass): the Publish pass, which judges what a library's build would ship.
