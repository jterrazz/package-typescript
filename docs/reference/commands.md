# Commands

Every command of the `typescript` binary. `check` and `fix` are the two a project runs every day; the rest build, run, measure, or adopt a release.

```bash
npx typescript build           # Build what the manifest publishes (ESM, CJS where it names one, types)
npx typescript start           # Run the built application
npx typescript dev             # Build, run, and rebuild on changes
npx typescript check           # Every quality pass, in parallel, ending on a drift report
npx typescript fix             # Rewrite in place: lint, formatting, the .gitignore, spellings, fallen baseline counts
npx typescript doctor          # Installed tool versions against the declared ranges, then where each setting comes from
npx typescript baseline        # Record today's debt so that it may only fall
npx typescript mutation        # The module tests, then the whole suite over the changed lines they leave
npx typescript docs-layout .   # Check a repository's docs/ against the manual's shape
npx typescript clean           # Remove .artifacts/ (dist/ stays: it is the product)
npx typescript tsc             # The TypeScript 7 compiler, passed through
```

| Command                        | Read                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `build`, `start`, `dev`, `tsc` | [Building](building.md)                                                                                     |
| `check`, `fix`                 | [Quality checks](quality-checks.md), and its [flags and exit codes](quality-checks.md#flags-and-exit-codes) |
| `doctor`, `baseline`           | [Adopt a stricter release](../guides/adopt-a-stricter-release.md#the-two-gestures)                          |
| `mutation`                     | [Quality checks § Mutation](quality-checks.md#mutation)                                                     |
| `docs-layout`                  | [Quality checks § Outside an npm project](quality-checks.md#outside-an-npm-project)                         |
| `clean`                        | [Getting started § Where a tool's output goes](../start/getting-started.md#where-a-tools-output-goes)       |
