# Building

Four commands cover the whole build lifecycle — `build` and `bundle` produce artifacts, `start` and `dev` run them — and `tsc` passes the compiler through beside them.

The pipeline is fully compiled and Rust-fast: [tsdown](https://tsdown.dev) / [Rolldown](https://rolldown.rs) transpile, bundle, and emit declarations.

| Command             | Output             | Description                               |
| ------------------- | ------------------ | ----------------------------------------- |
| `typescript build`  | `dist/index.js`    | ESM bundle                                |
|                     | `dist/index.d.ts`  | TypeScript declarations                   |
| `typescript bundle` | `dist/index.js`    | ESM bundle                                |
|                     | `dist/index.cjs`   | CommonJS bundle                           |
|                     | `dist/index.d.ts`  | TypeScript declarations                   |
| `typescript start`  | —                  | Runs `dist/index.js`                      |
| `typescript dev`    | `dist/index.js`    | Watch + rebuild + run                     |
| `typescript tsc`    | whatever tsc emits | The TypeScript 7 compiler, passed through |

## The entries

A build compiles what the package PUBLISHES, and the package already says what that is: its `exports`, `main` and `bin`. Each target under `dist/` is compiled from its entry under `src/`, named by [the entry grammar](06-quality-checks.md#the-entry-grammar), and written where the manifest says:

| Manifest                                                 | Entry                        | Output                  |
| -------------------------------------------------------- | ---------------------------- | ----------------------- |
| `".": "./dist/index.js"`                                 | `src/index.ts`               | `dist/index.js`         |
| `"./register": "./dist/register.js"`                     | `src/index.register.ts`      | `dist/register.js`      |
| `"./rules": { "browser": "./dist/rules.browser.js", … }` | `src/index.rules.browser.ts` | `dist/rules.browser.js` |
| `"bin": { "greet": "./dist/greet.js" }`                  | `src/greet.bin.ts`           | `dist/greet.js`         |

A package with no manifest target under `dist/` compiles `src/index.ts` alone. A pattern (`./tsconfig/*`) is skipped, because the map does not enumerate what it stands for, and so is a target whose entry is not on disk. So a multi-entry package needs no `tsdown.config.ts` — which is the whole point, since owning one means declaring tsdown, and the contract is one devDependency ([Developing](02-developing.md)). The `build` and `bundle` presets read the entries themselves, so a config of your own that extends one inherits them.

## build vs bundle

- **`build`** — for applications. Emits ESM + declarations + source maps.
- **`bundle`** — for libraries. Adds a CommonJS artifact so the package resolves under both `import` and `require`.

## A build that fails

When tsdown stops, its own report is printed as it came, and below it the command's four-part refusal — what failed, why a stale `dist/` matters, what to do, and this section — then the command exits 1. Nothing of the partial output is cleaned up for you: the next build starts by clearing `dist/`.

## tsc

`typescript tsc <args…>` runs the TypeScript 7 Go compiler this package ships, with the arguments handed straight to it. It exists for the one thing `check` cannot do — EMIT — which a repository built on project references does with `tsc --build`. Without it, such a repository reaches for `tsc` on PATH: whatever version the tree hoisted, which is how a package that dropped its own `typescript` dependency compiled against TypeScript 5 without noticing.

## start and dev

- **`start`** runs the built `dist/index.js` with `--enable-source-maps` for readable stack traces.
- **`dev`** builds once, runs, then rebuilds and reruns on every file change.

## Project structure

```text
your-project/
├── src/
│   ├── index.ts                 # The `.` entry
│   └── index.instrumentation.ts # The `./instrumentation` entry, when the package publishes one
├── dist/                  # The build's product — published from here
├── .artifacts/            # Every tool's output, gitignored (Developing)
└── tsconfig.json          # Extends this package
```

## Related

- [Developing](02-developing.md) — install and config.
