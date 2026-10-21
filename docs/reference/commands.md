# Commands

Every command of the `typescript` binary. `check` and `fix` are the two a project runs every day; the rest build, run, test, measure, or adopt a release. `check`, `test` and `mutation` answer a tree they already proved green from that proof, and run nothing ([Quality checks § A tree proven green](quality-checks.md#a-tree-proven-green)).

```bash
npx typescript build           # Build what the manifest publishes (ESM, CJS where it names one, types); --watch rebuilds on change and runs nothing
npx typescript start           # Run the built application
npx typescript dev             # Build, run, and rebuild on changes
npx typescript check           # Every quality pass, in parallel, ending on a drift report
npx typescript fix             # Rewrite in place: lint, formatting, the .gitignore, spellings, fallen baseline counts
npx typescript doctor          # Installed tool versions against the declared ranges, then where each setting comes from
npx typescript baseline        # Record today's debt so that it may only fall
npx typescript test            # The project's test script, unless this tree is proven green for it
npx typescript mutation        # The module tests over the change, then the whole suite over the changed lines they leave
npx typescript docs-layout .   # Check a repository's docs/ against the manual's shape
npx typescript gate-lock       # Refuse while a running gate holds this checkout, naming its pid
npx typescript rehearse        # The gate on Linux, in Docker, on a fresh clone of the branch, before a tag
npx typescript clean           # Remove .artifacts/ (dist/ stays: it is the product)
npx typescript tsc             # The TypeScript 7 compiler, passed through
```

| Command                        | Read                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `build`, `start`, `dev`, `tsc` | [Building](building.md)                                                                                     |
| `check`, `fix`                 | [Quality checks](quality-checks.md), and its [flags and exit codes](quality-checks.md#flags-and-exit-codes) |
| `doctor`, `baseline`           | [Adopt a stricter release](../guides/adopt-a-stricter-release.md#the-two-gestures)                          |
| `mutation`                     | [Quality checks § Mutation](quality-checks.md#mutation)                                                     |
| `test`                         | [Quality checks § A tree proven green](quality-checks.md#a-tree-proven-green)                               |
| `docs-layout`                  | [Quality checks § Outside an npm project](quality-checks.md#outside-an-npm-project)                         |
| `clean`                        | [Getting started § Where a tool's output goes](../start/getting-started.md#where-a-tools-output-goes)       |
| `gate-lock`                    | [Quality checks § One gate per checkout](quality-checks.md#one-gate-per-checkout)                           |
| `rehearse`                     | [A rehearsal on Linux](#a-rehearsal-on-linux), below                                                        |

## Flags and help

`typescript --help` lists the commands, and `typescript <command> --help` (or `-h`) prints that command's usage, its flags, and the page that owns it, then exits `0` having run nothing: `fix --help` writes no file, `mutation --help` starts no run. Help wins over every other word on the line.

Each command reads only the flags it declares, and refuses any other line before it reads or writes a file, in four parts, above its usage, exiting `1`:

| Command                                        | Reads                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `check`                                        | `--cold` and `--json`, each once                                             |
| `test`                                         | `--cold`, once                                                               |
| `fix`, `baseline`                              | no flag                                                                      |
| `mutation`                                     | `--cold`, `--mutate <ranges>` and `--since <ref>`, each once                 |
| `rehearse`                                     | `--branch <name>` and `--targets <targets>`, each once                       |
| `docs-layout`                                  | one `<root>`, the working directory when none is named                       |
| `build`, `dev`, `doctor`, `clean`, `gate-lock` | nothing                                                                      |
| `start`                                        | every argument, handed to the application; after `--`, `-h` and `--help` too |
| `tsc`                                          | every argument, the compiler's own, its `--help` included                    |

A flag the command does not declare, one given twice that the table does not say repeats, a valued flag with no value, a value written on a flag that takes none (`--json=1`), and a word where the command takes no argument are each refused: a flag the command would ignore, or a second value that would silently replace the first, makes a run that is not the one asked for. A value is written after its flag or joined to it, `--since main` or `--since=main`; several `--mutate` ranges are one comma-separated value, `--mutate src/a.ts:10-20,src/b.ts:1-5`.

## A rehearsal on Linux

A gate green on a Mac proves little about the GitHub runner that publishes a release: the first runs of one release failed on five differences of host no local gate could see (oxlint's report form under `GITHUB_ACTIONS`, a Node patch, vitest's colours under `CI`, Linux's `ps`, and a root run reading fixtures a non-root runner cannot). `typescript rehearse` runs the gate as that runner does, before the tag:

- a fresh clone of the branch checked out (`--branch <name>` names another), so what is rehearsed is what is committed, never the working tree;
- in `node:24` under Docker, with `--init`, `CI=true` and `GITHUB_ACTIONS=true`, and none of the host's variables;
- installed from the lockfile the repository commits: `npm ci`, `bun install --frozen-lockfile` (the bun its `packageManager` pins) or `pnpm install --frozen-lockfile`;
- `make build lint test` (`--targets 'lint test'` names others), as the image's non-root `node` user, while the tools install as root;
- mutation off, since the runner measures it and it would only double the wait.

The tools follow the repository: a docker CLI always, on the host's socket, for the specs that drive containers; Go where git tracks a `go.mod`; chromium and its system libraries where the manifest declares `playwright` or `@playwright/test`. A worktree's `.git` is a file naming its main checkout's git directory, so that directory is mounted read-only at its own path, and the clone reads the branch there. The command exits with the gate's code. It needs a docker on the machine and the network, which is why no `check` runs it.
