# @jterrazz/typescript

Drop-in TypeScript build tooling with zero configuration.

## Installation

```bash
npm install @jterrazz/typescript
```

## Usage

### 1. Choose a TypeScript configuration

```json
// tsconfig.json - Pick one:
{ "extends": "@jterrazz/typescript/tsconfig/node" }  // Node.js projects
{ "extends": "@jterrazz/typescript/tsconfig/next" }  // Next.js projects
{ "extends": "@jterrazz/typescript/tsconfig/expo" }  // Expo/React Native
```

### 2. Use the CLI

```bash
npx typescript build       # Build application (ESM + types)
npx typescript bundle      # Bundle library (ESM + CJS + types)
npx typescript start       # Run the built application
npx typescript dev         # Build, run, and rebuild on changes
```

## What you get

- **Blazing fast** — Powered by [tsdown](https://tsdown.dev) / [Rolldown](https://rolldown.rs) (Rust)
- **Zero configuration** — Works out of the box
- **Multiple outputs** — ESM + CommonJS + TypeScript declarations
- **Source maps** — Full debugging support

### Build outputs

| Command             | Output            | Description             |
| ------------------- | ----------------- | ----------------------- |
| `typescript build`  | `dist/index.js`   | ESM bundle              |
|                     | `dist/index.d.ts` | TypeScript declarations |
| `typescript bundle` | `dist/index.js`   | ESM bundle              |
|                     | `dist/index.cjs`  | CommonJS bundle         |
|                     | `dist/index.d.ts` | TypeScript declarations |
| `typescript start`  | —                 | Runs `dist/index.js`    |
| `typescript dev`    | `dist/index.js`   | Watch + rebuild + run   |

## Project structure

```
your-project/
├── src/
│   ├── index.ts           # Main entry point
│   └── instrumentation.ts # Optional instrumentation entry point
├── dist/                  # Generated files
└── tsconfig.json          # Extends this package
```

## How it works

The package uses a fully compiled toolchain — no JavaScript in the hot path:

| Step         | Tool                                  | Language |
| ------------ | ------------------------------------- | -------- |
| Transpile    | [Oxc](https://oxc.rs) (via tsdown)    | Rust     |
| Bundle       | [Rolldown](https://rolldown.rs)       | Rust     |
| Declarations | [tsdown](https://tsdown.dev) built-in | Rust     |

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
