# Install an unreleased build

A release is proven on the projects that will take it before it is published: each one installs the toolchain — and `@jterrazz/test` beside it — from a local checkout, runs its own `make check`, and is moved back onto the registry range once the release is out. This guide is that install, under npm and under bun, and the order a wave of projects takes it in. Taking a published release is [Adopt a stricter release](adopt-a-stricter-release.md).

## The layout

The checkouts of the packages and of the projects sit side by side, so one relative path names each package from every project:

```text
repositories/
  package-typescript/       # the release, built: make build
  package-test/             # its build installs package-typescript the same way
  my-service/               # a project's clone, left on its own branch
  my-service-next/          # the project's worktree that takes the build
```

A project takes the build in a worktree of its own (`git worktree add ../my-service-next -b <branch>`), never by switching its clone's branch, and the worktree sits at the clone's depth, so `file:../package-typescript` reaches the same checkout from both. Build each package first: what a project installs is what `dist/` holds.

## Under npm

Point the two devDependencies at the checkouts and ask npm to install a copy of each package, the way the registry would:

```bash
npm pkg set devDependencies.@jterrazz/typescript=file:../package-typescript
npm pkg set devDependencies.@jterrazz/test=file:../package-test
echo 'install-links=true' >> .npmrc
```

A plain `file:` link would leave a symlink, and the project would then resolve vitest's types from two copies — the matchers type on one and not the other. `install-links=true` packs the folder and installs the tarball instead, so the copy holds exactly what a consumer of the release gets.

Then drop the two packages from the lockfile before installing. The lockfile still resolves them to the registry tarballs of the last release, and npm refuses a remote tarball for a spec that became `file:` (`EALLOWREMOTE`):

```bash
node -e "const f='package-lock.json',l=JSON.parse(require('fs').readFileSync(f));for(const k of Object.keys(l.packages))if(/(^|\/)node_modules\/@jterrazz\/(typescript|test)$/.test(k))delete l.packages[k];require('fs').writeFileSync(f,JSON.stringify(l,null,2)+'\n')"
npm install
```

`install-links` is global to the project: it packs every `file:` dependency, a sibling package that is never published included. Such a dependency is a copy for as long as the setting stands, so a bundler that watched its source through the symlink (Metro's `watchFolders`) no longer sees an edit to it — rebuild and reinstall it like the toolchain.

## Under bun

bun has no `install-links`, and its `file:<folder>` copies the whole folder, `node_modules` and all — a second vitest among them. So bun installs the tarball itself, packed into the project's `.artifacts/` (which git ignores):

```bash
(cd ../package-typescript && npm pack --ignore-scripts --pack-destination ../my-service-next/.artifacts/packages)
(cd ../package-test && npm pack --ignore-scripts --pack-destination ../my-service-next/.artifacts/packages)
```

```json
"@jterrazz/typescript": "file:.artifacts/packages/jterrazz-typescript-11.0.0.tgz",
"@jterrazz/test": "file:.artifacts/packages/jterrazz-test-17.0.0.tgz"
```

A workspace member names the same tarballs relative to itself (`file:../../.artifacts/packages/…`). bun caches a `file:` tarball by its path, so a tarball packed again under the same name is not extracted again, `--force` or not: clear the cache before reinstalling a fresh pack (`bun pm cache rm`).

## Taking a new build

A change to a package reaches a project in three steps: rebuild the package (`make build`), lay it again — `rm -rf node_modules/@jterrazz/typescript node_modules/@jterrazz/test && npm install` under npm, a fresh `npm pack` and `bun pm cache rm && bun install` under bun — then run the project's `make check`. Never install while a gate runs in the same checkout: `npm ci` empties `node_modules` under the running check, which then fails on modules it can no longer find.

## The order of a wave

A project installs a package only once every package it runs is on the same release. `@jterrazz/typescript` comes first and `@jterrazz/test`, which peers on it, second. After them, a package another project loads in its own gates — a published audit its specs run, a design kit its app bundles — moves to the release before that project does, and widens its peer range to the new major: a project whose specs run a package still written against the last major fails on that package, not on its own code.

## Back onto the registry

When the release is published, every project returns to the range: the two devDependencies to `^<major>.0.0`, the `install-links` line out of `.npmrc` (the file goes if it held nothing else), the `.artifacts/packages/` tarballs out of a bun project, then a fresh install that writes the registry into the lockfile again.

## Related

- [Adopt a stricter release](adopt-a-stricter-release.md) — `doctor` and `baseline`, once the build is installed.
- [Release](release.md) — how the release is published.
