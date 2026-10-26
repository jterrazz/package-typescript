# Agent brief: `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds and quality checks. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`, mapped by `docs/README.md`. Decisions this package alone took are in `docs/decisions/`. Do not duplicate it; link to it.

| Working on                                        | Read                                         |
| ------------------------------------------------- | -------------------------------------------- |
| the layers, the exports map, the two compilers    | `docs/concepts/architecture.md`              |
| the loop, where a change lands, what it owes      | `docs/guides/develop.md`                     |
| the specs, the fixtures, the self rules           | `docs/guides/test.md`                        |
| the release, which number moves                   | `docs/guides/release.md`                     |
| a bump that lands red on a project                | `docs/guides/adopt-a-stricter-release.md`    |
| a project taking a build before it is published   | `docs/guides/install-an-unreleased-build.md` |
| wiring a project onto the toolchain               | `docs/start/getting-started.md`              |
| `studio.config.ts`, presets, their merge order    | `docs/reference/configuration.md`            |
| check / fix and their passes, the ratchet         | `docs/reference/quality-checks.md`           |
| the rulebook, profiles, knip                      | `docs/reference/lint-presets.md`             |
| build / start / dev / tsc                         | `docs/reference/building.md`                 |
| the rules kit a sibling package writes rules with | `docs/reference/rules-kit.md`                |

The manual is cut by its reader's need (`start/`, `guides/`, `concepts/`, `reference/`), the shape every repository of the ecosystem keeps, and this repository's own gate refuses a tree that breaks it (`docs/reference/quality-checks.md`, the Docs (layout) pass).

One Claude Code skill routes into this corpus: `skills/studio-typescript/SKILL.md`. It says what to run, what each failing pass means and the page to read next. It is hand-written, it never restates a page, and the Markdown (prose) pass fails it when it names a page that does not exist.

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

## Setup

```bash
make install
```

`make build` compiles the TypeScript into `dist/` with the build plan it ships; `make lint`, `make test` and `make fix` build first. It dogfoods its own CLI: `make lint` runs `npm run lint`, which runs `node dist/typescript.js check`.

## Repo layout

```text
lint/     # every judgement: consumer/ and self/ declare, kit/ runs
src/      # the command, the presets, the importable entries
docs/     # the corpus: start/, guides/, concepts/, reference/, decisions/
skills/   # the Claude Code skill: one hand-written SKILL.md
specs/    # product specifications (@jterrazz/test)
```

What each root and folder holds is [Architecture](docs/concepts/architecture.md)'s; the shape of `specs/` is `docs/guides/test.md`'s.

## Commands and the standing rule

The gestures and what each one runs are [Develop § The loop](docs/guides/develop.md#the-loop)'s, and the rule that a change to the public surface reaches three places is [Develop § What a change owes](docs/guides/develop.md#what-a-change-owes)'s. A change to a lint decision is a line of a fragment under `lint/` and nothing else, since the reference's catalogue is its projection. The repo-structure doctrine is the estate's, carried by the `studio-repo-structure` skill, and never authored here.
