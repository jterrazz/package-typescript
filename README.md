# Package Typescript

Drop-in tsconfig presets for consistent builds.

## Installation

```bash
npm install @jterrazz/typescript
```

## Usage

### 1. Choose a TypeScript configuration

```json
// tsconfig.json - Pick one:
{
  "extends": "@jterrazz/typescript/tsconfig/node"     // Node.js projects
}
{
  "extends": "@jterrazz/typescript/tsconfig/next"     // Next.js projects
}
{
  "extends": "@jterrazz/typescript/tsconfig/expo"     // Expo/React Native
}
```

### 2. Use the build commands

```bash
npx ts-dev    # Development with watch mode
npx ts-build  # Production build (generates .js, .d.ts, .cjs)
```

## What you get

- **Fast compilation** with SWC (10x faster than tsc)
- **Zero configuration** - works out of the box
- **Multiple outputs** - ESM + CommonJS + TypeScript declarations
- **Source maps** for debugging

## Project structure

```
your-project/
├── src/
│   └── index.ts    # Your TypeScript code
├── dist/           # Generated files
└── tsconfig.json   # Extends this package
```

That's it! The package handles all the complex build configuration so you can focus on writing code.

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
