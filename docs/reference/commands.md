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

## Flags and help

`typescript --help` lists the commands, and `typescript <command> --help` — or `-h` — prints that command's usage, its flags, and the page that owns it, then exits `0` having run nothing: `fix --help` writes no file, `mutation --help` starts no run. Help wins over every other word on the line.

Each command reads only the flags it declares, and refuses any other line before it reads or writes a file, in four parts, above its usage, exiting `1`:

| Command                           | Reads                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `check`                           | `--ignore-pattern <glob>`, as many times as needed; `--json`, once           |
| `fix`, `baseline`                 | `--ignore-pattern <glob>`, as many times as needed                           |
| `mutation`                        | `--mutate <ranges>` and `--since <ref>`, each once                           |
| `docs-layout`                     | one `<root>`, the working directory when none is named                       |
| `build`, `dev`, `doctor`, `clean` | nothing                                                                      |
| `start`                           | every argument, handed to the application; after `--`, `-h` and `--help` too |
| `tsc`                             | every argument, the compiler's own, its `--help` included                    |

A flag the command does not declare, one given twice that the table does not say repeats, a valued flag with no value, a value written on a flag that takes none (`--json=1`), and a word where the command takes no argument are each refused: a flag the command would ignore, or a second value that would silently replace the first, makes a run that is not the one asked for. A value is written after its flag or joined to it, `--since main` or `--since=main`; several `--mutate` ranges are one comma-separated value, `--mutate src/a.ts:10-20,src/b.ts:1-5`.
