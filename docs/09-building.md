# Building

Four commands cover a project's build and run: `build` and `bundle` produce `dist/`, `start` and `dev` run it. A fifth, `tsc`, passes the compiler through for the one thing they do not do. The pipeline is [tsdown](https://tsdown.dev) over [Rolldown](https://rolldown.rs): it transpiles, bundles and emits the declarations.

| Command             | Produces                                                             | For                                        |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `typescript build`  | ESM, declarations and source maps                                    | an application                             |
| `typescript bundle` | ESM and CommonJS, declarations and source maps                       | a library, loaded by `import` or `require` |
| `typescript start`  | nothing: runs the built `dist/index.js`, with `--enable-source-maps` | an application                             |
| `typescript dev`    | builds, runs, then rebuilds and reruns on every change               | an application                             |
| `typescript tsc`    | whatever the compiler emits                                          | a repository built on project references   |

## The entries

A build compiles what the package publishes, and its `package.json` already says what that is: its `exports`, `main` and `bin`. Each target under `dist/` is compiled from its entry under `src/`, named by [the entry grammar](07-quality-checks.md#the-entry-grammar), and written where the manifest says:

| Manifest                                                 | Entry                        | Output                  |
| -------------------------------------------------------- | ---------------------------- | ----------------------- |
| `".": "./dist/index.js"`                                 | `src/index.ts`               | `dist/index.js`         |
| `"./register": "./dist/register.js"`                     | `src/index.register.ts`      | `dist/register.js`      |
| `"./rules": { "browser": "./dist/rules.browser.js", … }` | `src/index.rules.browser.ts` | `dist/rules.browser.js` |
| `"bin": { "greet": "./dist/greet.js" }`                  | `src/greet.bin.ts`           | `dist/greet.js`         |

A package with no manifest target under `dist/` compiles `src/index.ts` alone. A pattern (`./tsconfig/*`) is skipped, since the map does not enumerate what it stands for, and so is a target whose entry is not on disk.

So a package with several entries needs no `tsdown.config.ts`, which is the point: owning one would mean declaring tsdown, and the contract is one devDependency ([Getting started](05-getting-started.md#the-shape-a-consumer-keeps)).

## A config of your own

A project that does own a `tsdown.config.ts` starts from the preset of its command, which reads the entries the same way, and imports it from this package so the import is typed:

```ts
// tsdown.config.ts
import bundle from '@jterrazz/typescript/tsdown/bundle';

export default bundle;
```

`@jterrazz/typescript/tsdown/build` is the application preset, `@jterrazz/typescript/tsdown/bundle` the library one, and each exports tsdown's `UserConfig` type beside it.

The `bundle` preset turns on `isolatedDeclarations`: a library's declarations are emitted without a type-checker, so `typescript bundle` refuses an export whose type it would have to infer. It is the build's setting rather than the `library` tsconfig's, because it is a property of the published artefact; in the tsconfig it would also reach every spec file, where it refuses the destructured export a specification hands back (TS9019).

## A build that fails

When tsdown stops, its own report is printed as it came, and below it the command's four-part refusal: what failed, why a stale `dist/` matters, what to do, and this section. The command exits 1. Nothing of the partial output is cleaned up; the next build starts by clearing `dist/`.

## tsc

`typescript tsc <args…>` runs the TypeScript 7 Go compiler this package ships, with the arguments handed straight to it. It exists for the one thing `check` cannot do, emit, which a repository built on project references does with `"build": "typescript tsc --build"`. Without it, such a repository reaches for whatever `tsc` the tree hoisted onto `PATH`, and can compile against an older TypeScript without noticing.

## Related

- [Getting started](05-getting-started.md): the scripts that call these commands.
- [Quality checks](07-quality-checks.md#the-publish-packaging-pass): the Publish pass, which judges what a library's build would ship.
