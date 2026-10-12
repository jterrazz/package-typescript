# Install an unreleased build

A release is proven on the projects that will take it before it is published: each one installs the toolchain — and `@jterrazz/test` beside it — from the tarball of a gated checkout, runs its own `make check`, and is moved back onto the registry range once the release is out. This guide is that install, one recipe for npm, pnpm and bun, and the order a wave of projects takes it in. Taking a published release is [Adopt a stricter release](adopt-a-stricter-release.md).

## The recipe

One tarball per package, packed from a gated `HEAD` into the project's own `.artifacts/packages/` (which git ignores), and named by the project's devDependencies. Nothing depends on where the checkouts sit: no `../` depth, no `.npmrc`, no `install-links` — which packed every `file:` dependency of the project, a design kit included, and kept a stale copy of it.

```bash
# from the project's root; PACKAGES is the folder holding the package checkouts, each on a commit that passed its gate
PACKAGES=/path/to/repositories
mkdir -p .artifacts/packages
for package in package-typescript package-test; do
  (cd "$PACKAGES/$package" && npm pack --ignore-scripts --silent --pack-destination "$OLDPWD/.artifacts/packages")
done
```

`--ignore-scripts` keeps `prepare` from rebuilding `dist/` while the tarball is read: the build is the checkout's, as gated. Then name the two tarballs, whatever the package manager:

```bash
npm pkg set \
  "devDependencies.@jterrazz/typescript=file:.artifacts/packages/jterrazz-typescript-11.0.0.tgz" \
  "devDependencies.@jterrazz/test=file:.artifacts/packages/jterrazz-test-17.0.0.tgz"
```

A workspace member names the same tarballs relative to itself (`file:../../.artifacts/packages/…`). Then drop every lockfile entry under `node_modules/@jterrazz/` — the nested trees of the previous toolchain included, whose transitive entries (`get-tsconfig`, oxlint's bindings) would otherwise stay resolved to the old versions — and write the lockfile back with its own indent, so the diff holds the install and not a re-indentation of 15 000 lines:

```bash
node -e "
const fs = require('fs');
const file = 'package-lock.json';
const text = fs.readFileSync(file, 'utf8');
const lock = JSON.parse(text);
for (const key of Object.keys(lock.packages)) if (key.includes('node_modules/@jterrazz/')) delete lock.packages[key];
const indent = /^( +|\t)\"/m.exec(text)?.[1] ?? 2;
fs.writeFileSync(file, JSON.stringify(lock, null, indent) + '\n');
"
npm install
```

Under pnpm and bun the lockfile is not JSON: delete it when it carries an older toolchain, and `pnpm install` / `bun install` writes it again; bun caches a `file:` tarball by its path, so a tarball packed again under the same name is not extracted again — clear the cache first (`bun pm cache rm`).

A `file:` package packed again under the same name changes no line of the lockfile, so the Makefile's install stamp must depend on `.artifacts/packages/*.tgz` beside the lockfile (`node_modules/.install: package-lock.json $(wildcard .artifacts/packages/*.tgz)`), or a gate runs for hours against yesterday's build; `make -B install` forces it once.

The tarball holds exactly what a consumer of the release gets, so the project resolves one copy of vitest's types, never two.

## The packages themselves

`@jterrazz/test` peers on `@jterrazz/typescript`, and its manifest keeps that peer at the registry range (`^11.0.0`) for the whole development: only its devDependency is a `file:`. A peer written as `file:../package-typescript` warned in every consumer.

## Taking a new build

A change to a package reaches a project in three steps: rebuild and gate the package, pack it again, then repeat the recipe and run the project's `make check`. Never install while a gate runs in the same checkout: `npm ci` empties `node_modules` under the running check, which then fails on modules it can no longer find, and a peer's install deleting `node_modules/@jterrazz/typescript/rules` in the middle of a mutation run fails it the same way. A package is gated once, from its own detached worktree, and the project takes the tarball of that run.

## The order of a wave

A project installs a package only once every package it runs is on the same release. `@jterrazz/typescript` comes first and `@jterrazz/test`, which peers on it, second. After them, a package another project loads in its own gates — a published audit its specs run, a design kit its app bundles — moves to the release before that project does, and widens its peer range to the new major: a project whose specs run a package still written against the last major fails on that package, not on its own code.

## Back onto the registry

When the release is published, every project returns to the range: the two devDependencies to `^<major>.0.0`, the `.artifacts/packages/` tarballs out, then a fresh install that writes the registry into the lockfile again.

## Related

- [Adopt a stricter release](adopt-a-stricter-release.md) — `doctor` and `baseline`, once the build is installed.
- [Release](release.md) — how the release is published.
