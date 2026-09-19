# Operating

This repository ships one thing: the npm package `@jterrazz/typescript`, published to the public registry.

There is no service, no image and no infrastructure — what "operating" means here is the release, and who is allowed to cut one.

## What a merge to `main` does

Nothing that reaches a consumer. `.github/workflows/validate.yaml` runs on every push and pull request to `main` and calls the shared `jterrazz-actions` validation workflow — install, lint, test. A green `main` is a publishable tree, not a published one.

## What publishes

`.github/workflows/release.yaml` fires on `release: created` and calls the shared `release-npm.yaml` workflow with npm provenance (`id-token: write`). So exactly one gesture publishes, and a human makes it: cutting a GitHub Release.

The sequence, in order:

1. the change merges to `main` and validates green;
2. a `chore(release): X.Y.Z` commit lands on `main`, bumping `version` in `package.json` and the lockfile — nothing else;
3. the owner tags `vX.Y.Z` and creates the GitHub Release;
4. the workflow publishes to npm.

Steps 2 to 4 are the owner's. A contributor never bumps the version inside a feature branch: two branches in flight would both claim the same number, and the tag is what the registry answers to.

## Which number moves

One line decides it, and it is the consumer's side of the wire: **breaking means the consumer must change HOW IT CONSUMES the package, or the package changes the consumer's runtime.** A stricter rule is neither of those — it changes what the consumer's code is allowed to look like, which is the job.

| Change                                                   | Number |
| -------------------------------------------------------- | ------ |
| a new command, a new export subpath, a new `check` pass  | minor  |
| a new rule inside an existing pass                       | minor  |
| a preset rule that starts failing code that used to pass | minor  |
| a removed command, a removed export, a renamed preset    | major  |
| a config file the consumer must rewrite to keep working  | major  |
| a fix that makes a gate stop lying                       | patch  |

**10.0.0 is a major on the fifth row, and on nothing else.** The rulebook got far stricter and the type-aware rules started running for the first time, and neither of those is what makes the number move: what does is that the four framework presets became six profiles, so every consumer rewrites the `import` line of its `oxlint.config.ts` and the `extends` of its `tsconfig.json`. A consumer that did not touch its config would resolve a name that is no longer there.

A new gate turning a consumer's `main` red is not treated as a breaking change, and that is deliberate: the toolchain's job is to say what is wrong, and a repository absorbs it when it bumps. The estate has no legacy mode and no warn-only window — a rule that is worth shipping is worth failing on.

What the ratchet changes is not that rule but the SHAPE of absorbing it: a repository adopting a stricter release records its debt with `typescript baseline` and burns it down on its own clock, instead of holding the bump until the tree is clean.

## Adopting a stricter release

Two gestures, and both are the consumer's:

```bash
typescript doctor     # what is installed, against what this release asks for
typescript baseline   # record the diagnostics, so the count may only fall
```

`doctor` is the first read after a bump. It prints one row per tool — node, the Go `tsc`, the TypeScript JS API, oxlint, oxfmt, `oxlint-tsgolint`, knip — with what is installed, what this package declares, and a verdict. A tool OLDER than its range fails, because a gate running an older linter enforces an older rulebook without saying so; a tool NEWER only warns, since a version ahead of its range may be perfectly fine and the toolchain does not get to decide that. Every number is read off an installed package's own manifest rather than a lockfile or a `--version` flag: that is the one place that cannot disagree with what node will load.

One section below that table is the PROJECT's rather than the toolchain's, and it is the one place a lockfile is the right file to read. `@vitest/browser-playwright` is published from vitest's own repository and carries vitest's version, so a provider even a patch away from the runner loads a second copy of vitest's internals and fails inside the browser, with a stack nobody reads as a version skew. When the lockfile resolves the provider at all, `doctor` prints both versions and fails the run unless they are exactly equal — a lockfile says what a fresh install will resolve, where a declared range says only what was allowed. It reads `package-lock.json`, `npm-shrinkwrap.json` and `bun.lock` — the last is JSON once its trailing commas are dropped, and its `packages` map opens each entry on the `name@version` the install resolved. `pnpm-lock.yaml`, `yarn.lock` and the binary `bun.lockb` are not parsed here, and a project declaring the provider under one of them — at its root OR in any workspace member, since browser mode belongs to whichever package runs it — is told so rather than passed over.

`baseline` is the second, and it is needed only where the bump lands red. It writes `oxlint.baseline.json` from the current counts, and from then on the oxlint pass refuses any rule going up, refuses a rule nobody recorded, and refuses an entry that has reached zero — so the file only ever shrinks. [Quality checks](06-quality-checks.md) owns the rules; what belongs here is when to reach for it: on the adoption pull request, in the same commit as the bump, never as a follow-up.

## How a consumer takes it

`@jterrazz/typescript` is a devDependency with a caret range, so a bump arrives by a dependency pull request in each repository and lands with that repository's own gates green. A migration a bump requires — new chapters, a moved config — belongs in the same pull request as the bump, never in a follow-up.

## Related

- [Testing](03-testing.md) — what `validate.yaml` runs.
- [Quality checks](06-quality-checks.md) — the gates a consumer inherits on a bump.
