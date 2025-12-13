*Hey there – I'm Jean-Baptiste, just another developer doing weird things with code. All my projects live on [jterrazz.com](https://jterrazz.com) – complete with backstories and lessons learned. Feel free to poke around – you might just find something useful!*

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

### 2. Use the build commands

```bash
npx ts-dev         # Development with watch mode
npx ts-build --app # Production build (ESM + types)
npx ts-build --lib # Library build (ESM + CJS + types)
```

## What you get

- **Blazing fast** — Powered by [Rolldown](https://rolldown.rs) (Rust) and [tsgo](https://github.com/nicolo-ribaudo/typescript-go) (Go)
- **Zero configuration** — Works out of the box
- **Multiple outputs** — ESM + CommonJS + TypeScript declarations
- **Source maps** — Full debugging support

### Build outputs

| Mode | Output | Description |
|------|--------|-------------|
| `ts-dev` | `dist/index.js` | ESM only, fast rebuilds (~20ms) |
| `ts-build --app` | `dist/index.js` | ESM bundle |
| | `dist/index.d.ts` | TypeScript declarations |
| `ts-build --lib` | `dist/index.js` | ESM bundle |
| | `dist/index.cjs` | CommonJS bundle |
| | `dist/index.d.ts` | TypeScript declarations |

If `src/instrumentation.ts` exists, it will also generate corresponding `instrumentation.*` files.

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

| Step | Tool | Language |
|------|------|----------|
| Transpile | [Oxc](https://oxc.rs) (via Rolldown) | Rust |
| Bundle | [Rolldown](https://rolldown.rs) | Rust |
| Declarations | [tsgo](https://github.com/nicolo-ribaudo/typescript-go) | Go |

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
