# Building

Three commands cover a project's build and run: `build` produces `dist/`, `start` and `dev` run it. A fourth, `tsc`, passes the compiler through for the one thing they do not do. The pipeline is [tsdown](https://tsdown.dev) over [Rolldown](https://rolldown.rs): it transpiles, bundles and emits the declarations, from a config the command derives and hands over — a project keeps no `tsdown.config.ts`, and the [Config (one file) pass](07-quality-checks.md#the-config-one-file-pass) refuses one.

| Command            | Produces                                                             | For                                      |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| `typescript build` | what the manifest publishes: ESM, declarations and source maps       | every kind                               |
| `typescript start` | nothing: runs the built `dist/index.js`, with `--enable-source-maps` | an application                           |
| `typescript dev`   | builds, runs, then rebuilds and reruns on every change               | an application                           |
| `typescript tsc`   | whatever the compiler emits                                          | a repository built on project references |

## The entries

A build compiles what the package publishes, and its `package.json` already says what that is: its `exports`, `main` and `bin`. Each target under `dist/` is compiled from its entry under `src/`, named by [the entry grammar](07-quality-checks.md#the-entry-grammar), and written where the manifest says:

| Manifest                                                 | Entry                        | Output                  |
| -------------------------------------------------------- | ---------------------------- | ----------------------- |
| `".": "./dist/index.js"`                                 | `src/index.ts`               | `dist/index.js`         |
| `"./register": "./dist/register.js"`                     | `src/index.register.ts`      | `dist/register.js`      |
| `"./rules": { "browser": "./dist/rules.browser.js", … }` | `src/index.rules.browser.ts` | `dist/rules.browser.js` |
| `"bin": { "greet": "./dist/greet.js" }`                  | `src/greet.bin.ts`           | `dist/greet.js`         |

A package with no manifest target under `dist/` compiles `src/index.ts` alone. A pattern (`./tsconfig/*`) is skipped, since the map does not enumerate what it stands for, and so is a target whose entry is not on disk.

Each target decides its output by its extension and its condition:

- a `.js` target is ESM, with its declarations and source map;
- a `.cjs` target adds a CommonJS output beside the ESM one, for a package loaded by `require`;
- a `browser` condition is built apart, for the browser platform, with no declarations — its `types` are the node build's;
- the rest is built for the platform the project declares: the browser for `react`, `next`, `astro` and `expo`, Node otherwise.

A module two entries share is written once, as `dist/shared-<name>.js`. A `library` emits its declarations with the type-checker, so an export with no annotation is published with the type the checker infers for it. [ADR-018](decisions/018-a-project-declares-what-it-is-and-every-config-follows.md#consequences) records why they are not built file by file with `isolatedDeclarations`.

### What the manifest does not name

Two kinds of entry are not in `exports`, `main` or `bin`, and are declared under `typescript.build` in `jterrazz.config.ts`, each with its reason:

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: {
        build: {
            dev: {
                release: { reason: 'the release script CI runs', source: 'scripts/release.ts' },
            },
            entries: {
                testing: { reason: 'loaded by path by the test preset', source: 'src/testing.ts' },
            },
        },
    },
});
```

`entries` are shipped beside the published ones, in `dist/`; `dev` entries are scripts the repository builds for itself, into `.artifacts/dev/`, never shipped. An entry with no `{ source, reason }` is refused in four parts, reading this section.

## A build that fails

When tsdown stops, its own report is printed as it came, and below it the command's four-part refusal: what failed, why a stale `dist/` matters, what to do, and this section. The command exits 1. Nothing of the partial output is cleaned up; the next build starts by clearing `dist/`. A configuration the command cannot derive — a `typescript.build` it cannot read — is refused before tsdown runs, in the same four parts.

## tsc

`typescript tsc <args…>` runs the TypeScript 7 Go compiler this package ships, with the arguments handed straight to it. It exists for the one thing `check` cannot do, emit, which a repository built on project references does with `"build": "typescript tsc --build"`. Without it, such a repository reaches for whatever `tsc` the tree hoisted onto `PATH`, and can compile against an older TypeScript without noticing.

## Related

- [Getting started](05-getting-started.md): the scripts that call these commands.
- [Quality checks](07-quality-checks.md#the-publish-packaging-pass): the Publish pass, which judges what a library's build would ship.
