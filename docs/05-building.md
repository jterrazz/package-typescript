# Building

Four commands cover the whole build lifecycle — `build` and `bundle` produce artifacts, `start` and `dev` run them.

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

## build vs bundle

- **`build`** — for applications. Emits ESM + declarations + source maps.
- **`bundle`** — for libraries. Adds a CommonJS artifact so the package resolves under both `import` and `require`.

## tsc

`typescript tsc <args…>` runs the TypeScript 7 Go compiler this package ships, with the arguments handed straight to it. It exists for the one thing `check` cannot do — EMIT — which a repository built on project references does with `tsc --build`. Without it, such a repository reaches for `tsc` on PATH: whatever version the tree hoisted, which is how a package that dropped its own `typescript` dependency compiled against TypeScript 5 without noticing.

## start and dev

- **`start`** runs the built `dist/index.js` with `--enable-source-maps` for readable stack traces.
- **`dev`** builds once, runs, then rebuilds and reruns on every file change.

## Project structure

```
your-project/
├── src/
│   ├── index.ts           # Main entry point
│   └── instrumentation.ts # Optional instrumentation entry point
├── dist/                  # The build's product — published from here
├── .artifacts/            # Every tool's output, gitignored (Getting started)
└── tsconfig.json          # Extends this package
```

## Related

- [Developing](02-developing.md) — install and config.
- [Docs pipeline](08-docs-pipeline.md) — the `docs` compiler for libraries.
