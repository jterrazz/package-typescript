# @jterrazz/typescript

The complete TypeScript toolchain — build, run, check, and document with zero configuration. Powered by tsdown, Oxlint, Oxfmt, TypeScript 7, and Knip.

## Installation

```bash
npm install @jterrazz/typescript --save-dev
```

## The CLI

```bash
npx typescript build       # Build application (ESM + types)
npx typescript bundle      # Bundle library (ESM + CJS + types)
npx typescript start       # Run the built application
npx typescript dev         # Build, run, and rebuild on changes
npx typescript docs        # Compile the committed docs/reference tree from source
npx typescript check       # Type-check, lint, format-check, and unused-code in parallel
npx typescript fix         # Auto-fix lint and formatting issues
```

## How it works

Fully compiled — no JavaScript in the hot path:

| Step         | Tool                                                             | Language |
| ------------ | ---------------------------------------------------------------- | -------- |
| Transpile    | [Oxc](https://oxc.rs) (via tsdown)                               | Rust     |
| Bundle       | [Rolldown](https://rolldown.rs)                                  | Rust     |
| Declarations | [tsdown](https://tsdown.dev) built-in                            | Rust     |
| Type check   | [tsc (TypeScript 7)](https://github.com/microsoft/typescript-go) | Go       |
| Lint         | [Oxlint](https://oxc.rs/docs/guide/usage/linter)                 | Rust     |
| Format       | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter)               | Rust     |
| Unused code  | [Knip](https://knip.dev)                                         | Node     |
| API docs     | [Typedoc](https://typedoc.org)                                   | Node     |

## Documentation

The full corpus lives in [`docs/`](docs/):

- [Getting started](docs/01-getting-started.md) — install and configure a project.
- [Building](docs/02-building.md) — `build`, `bundle`, `start`, `dev`.
- [Quality checks](docs/03-quality-checks.md) — `check` / `fix` and their passes.
- [Lint presets](docs/04-lint-presets.md) — oxlint presets, `compose`, architecture, knip.
- [Docs pipeline](docs/05-docs-pipeline.md) — the `typescript docs` compiler.
- [Repo structure](docs/06-repo-structure.md) — pointer to the shared doctrine; what's TypeScript-specific here.

For agents: read the chapters and the generated [`docs/reference/`](docs/reference/) tree straight from the repo, plus the [`skills/jterrazz-typescript`](skills/jterrazz-typescript/SKILL.md) Claude Code skill (the toolchain). The repo-structure doctrine itself is a Claude Code skill too — `jterrazz-repo-structure`, shipped from [`jterrazz-studio`](https://github.com/jterrazz/jterrazz-studio).

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
