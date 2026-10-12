# Adopt a stricter release

A new `@jterrazz/typescript` can land red on a project that was green: a stricter release is a minor ([Release § Which number moves](release.md#which-number-moves)). This guide takes the bump to green in the pull request that makes it.

## How a consumer takes it

`@jterrazz/typescript` is a devDependency with a caret range, so a bump arrives by a dependency pull request in each repository and lands with that repository's own gates green. A migration a bump requires — a recut manual, a moved config — belongs in the same pull request as the bump, never in a follow-up. A major names the configs it makes a consumer rewrite in [Release § Which number moves](release.md#which-number-moves).

## The two gestures

Two gestures, and both are the consumer's:

```bash
typescript doctor     # what is installed, against what this release asks for
typescript baseline   # record the debt, so each count may only fall
```

`doctor` is the first read after a bump. It prints one row per tool — node, the Go `tsc`, the TypeScript JS API, oxlint, oxfmt, `oxlint-tsgolint`, knip, dependency-cruiser, ls-lint, rumdl — with what is installed, what this package declares, and a verdict. A tool OLDER than its range fails, because a gate running an older linter enforces an older rulebook without saying so; a tool NEWER only warns, since a version ahead of its range may be perfectly fine and the toolchain does not get to decide that. Every number is read off an installed package's own manifest rather than a lockfile or a `--version` flag: that is the one place that cannot disagree with what node will load.

### The provider pinned to its runner

One section below that table is the PROJECT's rather than the toolchain's, and it is the one place a lockfile is the right file to read. `@vitest/browser-playwright` is published from vitest's own repository and carries vitest's version, so a provider even a patch away from the runner loads a second copy of vitest's internals and fails inside the browser, with a stack nobody reads as a version skew. When the lockfile resolves the provider at all, `doctor` prints both versions and fails the run unless they are exactly equal — a lockfile says what a fresh install will resolve, where a declared range says only what was allowed. It reads `package-lock.json`, `npm-shrinkwrap.json` and `bun.lock` — the last is JSON once its trailing commas are dropped, and its `packages` map opens each entry on the `name@version` the install resolved. `pnpm-lock.yaml`, `yarn.lock` and the binary `bun.lockb` are not parsed here, and a project declaring the provider under one of them — at its root OR in any workspace member, since browser mode belongs to whichever package runs it — is told so rather than passed over.

### The browser build on the machine

A project that declares Playwright and resolves it owes the machine the Chromium builds that Playwright launches, and each Playwright revision wants its own: three revisions on one machine are three caches, and the newest one's headless shell may never have been provisioned. `doctor` reads `playwright-core/browsers.json` from the project, looks for each `chromium` and `chromium-headless-shell` revision in the folder Playwright keeps its browsers in (`PLAYWRIGHT_BROWSERS_PATH`, else the cache of the platform), prints one row per build, and fails naming the missing ones; `npx playwright install chromium`, run in the project, provisions the revision that project resolves. A project that resolves no Playwright prints no such section.

Last, `doctor` prints the settings `jterrazz.config.ts` resolves to — of the root and of each workspace member —, one per line beside the file it comes from: a file of a package's standard, a preset, or the project's own ([Configuration § The merge order](../reference/configuration.md#the-merge-order)). A bump that changed a default shows there, under the file that now sets it.

`baseline` is the second, and it is needed only where the bump lands red. It records the lint debt in oxlint's `.jterrazz/oxlint-suppressions.json` and the Architecture and Names passes' in the `typescript` section of `.jterrazz/baseline.json`, and from then on each owner refuses any count going up, a rule nobody recorded, and an entry that fell or reached zero — so both files only ever shrink. [Quality checks](../reference/quality-checks.md) owns the rules; what belongs here is when to reach for it: on the adoption pull request, in the same commit as the bump, never as a follow-up.

## What a major newly judges, said once

A bump to 11 reads more than 10 did, and a project lands red on the first run. Said once here, so no project finds it by failing:

- **Astro islands are mutated.** The `.tsx` of a hydrated island belongs to the verdict; move its logic into `.ts` modules under module tests, and compare the markup whole by a spec ([Quality checks § What each kind leaves unmeasured](../reference/quality-checks.md#what-each-kind-leaves-unmeasured)).
- **Go comments are read and reported.** The Comments pass reads `.go` files with Go's shapes; `fix` deletes none, so sort the reported ones by script, as a migration sorts the `.ts` ones.
- **Manifest keys are known.** A key neither npm nor the family reads is refused; a credit or a fork's origin moves to the README.
- **Settings keys are known.** `typescript.generated` is gone, and a key a release removed now fails the file at load, before any pass runs, in four parts. Its replacement is `typescript.roots.<folder>` written `{ reason, verbatim: true }`.

## After the bump

`check` reports each `Unused oxlint-disable directive` a rule a release turned off leaves behind (`jsx-a11y/prefer-tag-over-role` was one): delete the directive, and never arm the rule again for it.

## Related

- [Install an unreleased build](install-an-unreleased-build.md) — taking a release from a local checkout, before it is published.
- [Quality checks](../reference/quality-checks.md) — the gates a consumer inherits on a bump.
