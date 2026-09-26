# Agent brief — `@jterrazz/typescript`

The complete TypeScript toolchain for the @jterrazz ecosystem: builds and quality checks. Zero config for consumers. This file **routes**; it does not restate what the corpus already says.

## Where knowledge lives (route here first)

The consumer-facing corpus is `docs/` + `README.md`, mapped by `docs/README.md`. Decisions this package alone took are in `docs/decisions/`. Do not duplicate it — link to it.

| Working on…                                    | Read                        |
| ---------------------------------------------- | --------------------------- |
| the layers, the exports map, the two compilers | `docs/01-architecture.md`   |
| setup, tsconfig/oxlint/oxfmt wiring, this repo | `docs/02-developing.md`     |
| the specs, the fixtures, the self-lint         | `docs/03-testing.md`        |
| the release, and which number moves            | `docs/04-operating.md`      |
| build / bundle / start / dev                   | `docs/05-building.md`       |
| check / fix and their passes                   | `docs/06-quality-checks.md` |
| oxlint presets, `compose`, architecture, knip  | `docs/07-lint-presets.md`   |
| repo doctrine (corpus / injection / compiler)  | `docs/08-repo-structure.md` |

The first four chapters are the spine every repository of the ecosystem carries — architecture, developing, testing, operating — and this repository's own gate refuses a tree that breaks it (`docs/06-quality-checks.md`, the Docs (layout) pass). The doctrine behind the spine is routed to from `docs/08-repo-structure.md`.

One Claude Code skill routes into this corpus: `skills/jterrazz-typescript/SKILL.md` — what to run, what each failing pass means, the chapter to read next. It is hand-written, it never restates a chapter, and the Markdown (prose) pass fails it when it names a chapter that does not exist.

`CLAUDE.md` at the root is a symlink to this file: one brief, two names, no second copy.

## Setup

```bash
make install
```

No build step — this package ships JS directly. It dogfoods its own CLI (`make lint` → `npm run lint` → `./bin/typescript.sh check`).

## Repo layout

```
bin/      # the CLI, in bash
lint/     # every judgement
src/      # the engine the CLI runs, the presets, the importable entries
docs/     # the corpus: numbered chapters and decisions/
skills/   # the Claude Code skill — one hand-written SKILL.md
specs/    # product specifications (@jterrazz/test)
```

What each root and folder holds is [Architecture](docs/01-architecture.md)'s; the shape of `specs/` is `docs/03-testing.md`'s.

## Commands and the standing rule

The gestures and what each one runs, and the rule that a change to the public surface reaches three places, are [Developing § Working on this package](docs/02-developing.md#working-on-this-package)'s. A change to a lint decision is a line of a fragment under `lint/` and nothing else — the chapter's catalogue is its projection. The repo-structure doctrine is never authored here or in a skill; `docs/08-repo-structure.md` routes to it.
