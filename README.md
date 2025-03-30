# Package Typescript

This package provides a consistent TypeScript configuration for projects. It includes two commands: `ts-compiler` and `ts-runner`.

## Installation

Install the package globally or locally:

```bash
npm install @jterrazz/typescript
```

## Usage

### TypeScript Configuration

Use the provided `tsconfig.json` in your project:

```json5
// tsconfig.json
{
  extends: '@jterrazz/typescript/tsconfig/node-esm',
  compilerOptions: {
    // Your custom compiler options here
  },
}
```

### Commands

- `ts-compiler`: Compile TypeScript files.
- `ts-runner`: Execute TypeScript files.

## Implementation Details

- The package reads directly from the `tsconfig.json` file, keeping the implementation details hidden.
- Consumers don't need to worry about the underlying scripts.

Happy coding!
