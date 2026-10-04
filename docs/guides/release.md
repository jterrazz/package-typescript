# Release

This repository ships one thing: the npm package `@jterrazz/typescript`, published to the public registry. There is no service, no image and no infrastructure — releasing it is the whole of shipping it, and this guide is how it is cut and which number it moves. Taking a release into a project is [Adopt a stricter release](adopt-a-stricter-release.md).

## What a merge to `main` does

Nothing that reaches a consumer. `.github/workflows/validate.yaml` runs on every push and pull request to `main` and calls the shared `jterrazz-actions` validation workflow — install, build, lint, test. A green `main` is a publishable tree, not a published one.

## What publishes

`.github/workflows/release.yaml` fires on `release: created` and calls the shared `release-npm.yaml` workflow with npm provenance (`id-token: write`). So exactly one gesture publishes, and a human makes it: cutting a GitHub Release.

The sequence, in order:

1. the change merges to `main` and validates green;
2. a `chore(release): X.Y.Z` commit lands on `main`, bumping `version` in `package.json` and the lockfile — nothing else;
3. the owner tags `vX.Y.Z` and creates the GitHub Release;
4. the workflow runs `make build` and publishes the `dist/` it wrote to npm.

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

## Related

- [Test](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md) — what `validate.yaml` runs.
- [Adopt a stricter release](adopt-a-stricter-release.md) — the consumer's side of a bump.
