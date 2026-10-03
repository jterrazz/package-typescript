# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds and quality checks. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`, mapped by `docs/README.md`. Decisions this package alone took are in `docs/decisions/`. Do not duplicate it — link to it.

| Working on…                                       | Read                         |
| ------------------------------------------------- | ---------------------------- |
| the layers, the exports map, the two compilers    | `docs/01-architecture.md`    |
| the loop, where a change lands, what it owes      | `docs/02-developing.md`      |
| the specs, the fixtures, the self rules           | `docs/03-testing.md`         |
| the release, which number moves, adopting a bump  | `docs/04-operating.md`       |
| wiring a project onto the toolchain               | `docs/05-getting-started.md` |
| `jterrazz.config.ts`, presets, their merge order  | `docs/06-configuration.md`   |
| check / fix and their passes, the ratchet         | `docs/07-quality-checks.md`  |
| the rulebook, profiles, `compose`, knip           | `docs/08-lint-presets.md`    |
| build / bundle / start / dev / tsc                | `docs/09-building.md`        |
| the rules kit a sibling package writes rules with | `docs/10-rules-kit.md`       |

The first four chapters are the spine every repository of the ecosystem carries — architecture, developing, testing, operating — and this repository's own gate refuses a tree that breaks it (`docs/07-quality-checks.md`, the Docs (layout) pass).

One Claude Code skill routes into this corpus: `skills/jterrazz-typescript/SKILL.md` — what to run, what each failing pass means, the chapter to read next. It is hand-written, it never restates a chapter, and the Markdown (prose) pass fails it when it names a chapter that does not exist.

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

## Setup

```bash
make install
```

`make build` compiles the TypeScript into `dist/` with tsdown; `make lint`, `make test` and `make fix` build first. It dogfoods its own CLI (`make lint` → `npm run lint` → `node dist/typescript.js check`).

## Repo layout

```text
lint/     # every judgement: consumer/ and self/ declare, kit/ runs
src/      # the command, the presets, the importable entries
docs/     # the corpus: numbered chapters and decisions/
skills/   # the Claude Code skill — one hand-written SKILL.md
specs/    # product specifications (@jterrazz/test)
```

What each root and folder holds is [Architecture](docs/01-architecture.md)'s; the shape of `specs/` is `docs/03-testing.md`'s.

## Commands and the standing rule

The gestures and what each one runs are [Developing § The loop](docs/02-developing.md#the-loop)'s, and the rule that a change to the public surface reaches three places is [Developing § What a change owes](docs/02-developing.md#what-a-change-owes)'s. A change to a lint decision is a line of a fragment under `lint/` and nothing else — the chapter's catalogue is its projection. The repo-structure doctrine is the estate's, carried by the `jterrazz-repo-structure` skill, and never authored here.
