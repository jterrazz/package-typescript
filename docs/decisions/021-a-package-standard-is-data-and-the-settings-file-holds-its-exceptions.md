# ADR-021: A package's standard is data, and the settings file holds its exceptions

**Status:** Accepted
**Date:** 2026-10-05
**Accepted:** 2026-10-04 — the owner's word on the programme ("standardiser un maximum, attention aux exceptions"), and on where the standard lives.

## Context

[ADR-018](018-a-project-declares-what-it-is-and-every-config-follows.md) made
`jterrazz.config.ts` the one settings file, and every section of it a name
mapped to its reason. Two years of defaults then landed there instead of in
the toolchain. This package's own file declared the `lint/` it ships as
mutation targets — what every library shipping rules declares the same way;
`@jterrazz/test`'s listed nine projects it could read off its `specs/`, ten
build entries a file name could say, a rule the rulebook already decided, and
25 lines of imperative code importing its own build; signews-api's declared
the worker and the instrumentation it loads by path, and the process exit its
kind always owes. A default stated in a repository is copied into the next
one, never reaches the repositories that lack it, and reads as an exception
when it is none. The drift report counted those lines as deviations.

The defaults that did live in the toolchain lived as code: the base preset's
laws, roots and rosters were constants of `lint/consumer/catalogue/preset.ts`,
beside the functions merging them for a platform, so nothing showed which
value a kind or a platform adds, nor where a resolved setting came from.

## Decision

Each package of the family keeps its standard under `src/standard/`, typed by
`defineStandard` as the settings file it defaults: this package's
`standard.ts`, `kinds/<kind>.ts` and `platforms/<platform>.ts`;
`@jterrazz/test`'s `standard.ts`. A standard is data only — the Config pass
refuses a function, a branch, a call, a variable there
(`config/standard-is-data`) — and the code applying it lives elsewhere. One
merge order: the standard, the kind's, the platform's, the other packages'
presets in the order listed, the project's file. `typescript doctor` prints
the resolved settings, each line beside the file it comes from.

What the tree says is derived, never declared: a module loaded by path is
built by its name (`instrumentation.ts`, `*.worker.ts`, `*.global-setup.ts`
into `dist/`, a `*.cli.ts` and the root modules of `lint/self/` into
`.artifacts/dev/`), and `typescript.build` is gone; `@jterrazz/test`'s test
projects are one per `specs/<specification>/` folder, and its unit project
reads every spine root holding a module test. A rule decided for every
repository is the rulebook's; what one kind or platform owes is its
standard's; what one package's users owe is its preset's. A test reading the
sources as text reads them as written under mutation, through `originalOf`,
instead of being excluded. A repository held to its own presets lists them
through `ownPresets`.

`jterrazz.config.ts` holds what the project is, its presets, and its true
exceptions, each with its reason; the drift report counts them.

## Consequences

- The three configs of the vision 17 programme fell from 60, 210 and 76 lines
  to what their exceptions say.
- A default changes in one place and reaches every repository on its next
  bump; `doctor` shows under which file it now lands.
- A name now carries a build decision: renaming `foo.worker.ts` changes what
  ships. Two modules built to one name are refused.
- `src/standard/` is the one place `lint/` may read under `src/`:
  `shipped-lint-reads-no-self` and `catalogue-at-the-bottom` let it through.
- A repository wanting a default other than its kind's writes an exception
  with its reason, and the drift report counts it.
