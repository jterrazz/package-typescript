# Building

Four commands cover the whole build lifecycle — `build` and `bundle` produce artifacts, `start` and `dev` run them.

The pipeline is fully compiled and Rust-fast: [tsdown](https://tsdown.dev) / [Rolldown](https://rolldown.rs) transpile, bundle, and emit declarations.

| Command             | Output            | Description             |
| ------------------- | ----------------- | ----------------------- |
| `typescript build`  | `dist/index.js`   | ESM bundle              |
|                     | `dist/index.d.ts` | TypeScript declarations |
| `typescript bundle` | `dist/index.js`   | ESM bundle              |
|                     | `dist/index.cjs`  | CommonJS bundle         |
|                     | `dist/index.d.ts` | TypeScript declarations |
| `typescript start`  | —                 | Runs `dist/index.js`    |
| `typescript dev`    | `dist/index.js`   | Watch + rebuild + run   |

## build vs bundle

- **`build`** — for applications. Emits ESM + declarations + source maps.
- **`bundle`** — for libraries. Adds a CommonJS artifact so the package resolves under both `import` and `require`.

## start and dev

- **`start`** runs the built `dist/index.js` with `--enable-source-maps` for readable stack traces.
- **`dev`** builds once, runs, then rebuilds and reruns on every file change.

## Project structure

```
your-project/
├── src/
│   ├── index.ts           # Main entry point
│   └── instrumentation.ts # Optional instrumentation entry point
├── dist/                  # Generated artifacts
└── tsconfig.json          # Extends this package
```

## Related

- [Getting started](01-getting-started.md) — install and config.
- [Docs pipeline](05-docs-pipeline.md) — the `docs` compiler for libraries.
