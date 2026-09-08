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

Semver, read from the CONSUMER's side — a project that owns one devDependency and runs two commands:

| Change                                                   | Number |
| -------------------------------------------------------- | ------ |
| a new command, a new export subpath, a new `check` pass  | minor  |
| a new rule inside an existing pass                       | minor  |
| a preset rule that starts failing code that used to pass | minor  |
| a removed command, a removed export, a renamed preset    | major  |
| a fix that makes a gate stop lying                       | patch  |

A new gate turning a consumer's `main` red is not treated as a breaking change, and that is deliberate: the toolchain's job is to say what is wrong, and a repository absorbs it when it bumps. The estate has no legacy mode and no warn-only window — a rule that is worth shipping is worth failing on.

## How a consumer takes it

`@jterrazz/typescript` is a devDependency with a caret range, so a bump arrives by a dependency pull request in each repository and lands with that repository's own gates green. A migration a bump requires — new chapters, a moved config — belongs in the same pull request as the bump, never in a follow-up.

## Related

- [Testing](03-testing.md) — what `validate.yaml` runs.
- [Quality checks](06-quality-checks.md) — the gates a consumer inherits on a bump.
