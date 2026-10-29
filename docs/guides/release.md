# Release

This repository ships one thing: the npm package `@jterrazz/typescript`, published to the public registry. There is no service, no image and no infrastructure. Releasing it is the whole of shipping it, and this guide is how it is cut and which number it moves. Taking a release into a project is [Adopt a stricter release](adopt-a-stricter-release.md).

## What a merge to `main` does

Nothing that reaches a consumer. `.github/workflows/check.yaml` runs on every push and pull request to `main` and calls the shared `studio-actions` Check workflow: install, build, lint, test. A green `main` is a publishable tree, not a published one.

## What publishes

`.github/workflows/release.yaml` fires on `release: created` and calls the shared `publish-npm.yaml` workflow with npm provenance (`id-token: write`). So exactly one gesture publishes, and a human makes it: cutting a GitHub Release.

The sequence, in order:

1. the change merges to `main` and validates green;
2. a `chore(release): X.Y.Z` commit lands on `main`, bumping `version` in `package.json` and the lockfile, and nothing else;
3. `make rehearse` runs the gate on that commit as the runner will, on Linux ([A rehearsal on Linux](../reference/commands.md#a-rehearsal-on-linux)), and exits 0;
4. the owner tags `vX.Y.Z` and creates the GitHub Release;
5. the workflow runs `make build` and publishes the `dist/` it wrote to npm.

Steps 2 to 5 are the owner's. A contributor never bumps the version inside a feature branch: two branches in flight would both claim the same number, and the tag is what the registry answers to.

## Which number moves

One line decides it, and it is the consumer's side of the wire: **breaking means the consumer must change HOW IT CONSUMES the package, or the package changes the consumer's runtime.** A stricter rule is neither of those. It changes what the consumer's code is allowed to look like, which is the job.

| Change                                                   | Number |
| -------------------------------------------------------- | ------ |
| a new command, a new export subpath, a new `check` pass  | minor  |
| a new rule inside an existing pass                       | minor  |
| a preset rule that starts failing code that used to pass | minor  |
| a removed command, a removed export, a renamed preset    | major  |
| a config file the consumer must rewrite to keep working  | major  |
| a fix that makes a gate stop lying                       | patch  |

**10.0.0 is a major on the fifth row, and on nothing else.** The rulebook got far stricter and the type-aware rules started running for the first time, and neither of those is what makes the number move: what does is that the four framework presets became six profiles, so every consumer rewrites the `import` line of its `oxlint.config.ts` and the `extends` of its `tsconfig.json`. A consumer that did not touch its config would resolve a name that is no longer there.

**11.0.0 is a major on the fourth and fifth rows.** A project now declares what it is, and every config follows from that declaration, so a 10.x consumer rewrites:

- its `oxlint.config.ts`, which composed profiles, into a `studio.config.ts` that declares its `kind` and `platform` ([Getting started](../start/getting-started.md#1-declare-what-the-project-is)); `typescript fix` then writes the derived `oxlint.config.ts`, `oxfmt.config.ts` and `tsconfig.json`;
- a `knip.json` into `typescript.knip`, and a `tsdown.config.ts` into the manifest's targets or a module named for how it is loaded: `typescript bundle` is gone, and `typescript build` derives what it compiles ([Building](../reference/building.md#the-entries));
- `studio.baseline.json` and `oxlint-suppressions.json` into `.studio/`, where `typescript baseline` writes them again;
- a Makefile chaining `@jterrazz/test`'s own check bin into `presets: [test()]`, run by `typescript check`, `fix` and `baseline`;
- a `typescript.generated` key, which 11.0.0 removed, into `typescript.roots.<folder>` written `{ reason, verbatim: true }`; the file now fails at load on a key no release reads ([Adopt a stricter release](adopt-a-stricter-release.md#what-a-major-newly-judges-said-once));
- each published entry's source onto [the entry grammar](../reference/quality-checks.md#the-entry-grammar), `index[.<subpath>].ts` and `<name>.bin.ts`.

**12.0.0 is a major on the fifth row, and on nothing else.** The ecosystem's substrate is named `studio` now, and `jterrazz` names only its owner, so the toolchain's own files follow: an 11.x consumer renames `jterrazz.config.ts` to `studio.config.ts` and the `.jterrazz/` folder to `.studio/`, and changes no line inside either. The skill is `studio-typescript`. The rulebook's plugin keeps its name, `jterrazz-typescript`, since it is the package's, and so does every suppression that names one of its rules.

The GitHub Release of each version is where its notes live; this section keeps only what makes a version major.

A new gate turning a consumer's `main` red is not treated as a breaking change, and that is deliberate: the toolchain's job is to say what is wrong, and a repository absorbs it when it bumps. The estate has no legacy mode and no warn-only window: a rule that is worth shipping is worth failing on.

What the ratchet changes is not that rule but the SHAPE of absorbing it: a repository adopting a stricter release records its debt with `typescript baseline` and burns it down on its own clock, instead of holding the bump until the tree is clean.

## Related

- [Test](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/test.md): what `check.yaml` runs.
- [Adopt a stricter release](adopt-a-stricter-release.md): the consumer's side of a bump.
