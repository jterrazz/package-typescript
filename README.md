# @jterrazz/typescript

The complete TypeScript toolchain — build, run and check with zero configuration. Powered by tsdown, Oxlint, Oxfmt, TypeScript 7, and Knip. Seven profiles, one rulebook: every rule of every plugin it loads is decided by name.

## Installation

```bash
npm install @jterrazz/typescript --save-dev
```

## The CLI

```bash
npx typescript build           # Build application (ESM + types)
npx typescript bundle          # Bundle library (ESM + CJS + types)
npx typescript start           # Run the built application
npx typescript dev             # Build, run, and rebuild on changes
npx typescript docs-layout .   # Check a repository's docs/ against the manual spine
npx typescript check           # Every quality pass, in parallel, ending on a drift report
npx typescript fix             # Auto-fix lint, formatting, the .gitignore, suppression spellings, fallen baseline counts
npx typescript doctor          # Installed tool versions against the ranges this release declares
npx typescript baseline        # Record today's oxlint diagnostics, so the count may only fall — fix re-records a fall
npx typescript clean           # Remove .artifacts/ (dist/ stays — it is the product)
```

## How it works

Fully compiled — no JavaScript in the hot path:

| Step         | Tool                                                                        | Language |
| ------------ | --------------------------------------------------------------------------- | -------- |
| Transpile    | [Oxc](https://oxc.rs) (via tsdown)                                          | Rust     |
| Bundle       | [Rolldown](https://rolldown.rs)                                             | Rust     |
| Declarations | [tsdown](https://tsdown.dev) built-in                                       | Rust     |
| Type check   | [tsc (TypeScript 7)](https://github.com/microsoft/typescript-go)            | Go       |
| Lint         | [Oxlint](https://oxc.rs/docs/guide/usage/linter)                            | Rust     |
| Format       | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter)                          | Rust     |
| Unused code  | [Knip](https://knip.dev)                                                    | Node     |
| Packaging    | [publint](https://publint.dev) + [attw](https://arethetypeswrong.github.io) | Node     |
| Layer map    | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)        | Node     |

## Documentation

The full corpus lives in [`docs/`](docs/):

- [Architecture](docs/01-architecture.md) — the four layers and what each one holds.
- [Developing](docs/02-developing.md) — install and configure a project.
- [Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md) — how this toolchain proves itself.
- [Operating](docs/04-operating.md) — what publishes it, and which number moves.
- [Building](docs/05-building.md) — `build`, `bundle`, `start`, `dev`.
- [Quality checks](docs/06-quality-checks.md) — `check` / `fix` and their fourteen passes.
- [Lint presets](docs/07-lint-presets.md) — the rulebook, the six profiles, `compose`, architecture, knip.
- [Repo structure](docs/08-repo-structure.md) — pointer to the shared doctrine; what's TypeScript-specific here.

For agents: read the chapters from wherever they resolve — this repo when the toolchain itself is the change, `node_modules/@jterrazz/typescript/docs/` when a consumer is — plus the [`skills/jterrazz-typescript`](https://github.com/jterrazz/package-typescript/blob/main/skills/jterrazz-typescript/SKILL.md) Claude Code skill, which says what to run and which chapter to open. The API is the types. The repo-structure doctrine itself is a Claude Code skill too — `jterrazz-repo-structure`, shipped from [`jterrazz-studio`](https://github.com/jterrazz/jterrazz-studio).

## License

MIT © [Jean-Baptiste Terrazzoni](https://github.com/jterrazz)
