# Configuration

What a project says about itself, and where it says it. Most projects stop at the three files of [Getting started](../start/getting-started.md); this page is for the day one has something of its own to declare.

| File                 | Holds                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `jterrazz.config.ts` | what the project is — its `kind` and `platform` — the presets it is held to, and every setting, with its reason |
| `tsconfig.json`      | an `extends` of the platform's preset, plus what `typescript.tsconfig` adds with its reason                     |
| `oxlint.config.ts`   | derived from its folder                                                                                         |
| `oxfmt.config.ts`    | derived from its folder                                                                                         |
| a preset's own file  | derived by the preset that declares it — `@jterrazz/test`'s `vitest.config.ts`, for a project on its preset     |
| `.jterrazz/`         | the debt the ratchet holds, tracked, and gone when it is paid ([the ratchet](quality-checks.md#the-ratchet))    |

The derived files are an editor's, which reads its tools' configs from fixed names, and they say nothing of their own: `typescript fix` writes them, and the [Config (one file) pass](quality-checks.md#the-config-one-file-pass) refuses one that says anything else. Every other tool — knip, the build, mutation testing — is configured by the command that runs it, from the same file, and keeps no config at the root.

## The settings file

`jterrazz.config.ts` is the one settings file of the `@jterrazz` family. This package owns it and types it: `defineConfig` knows every section a package of the family declares, and each package reads only its own.

```ts
// jterrazz.config.ts
import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'cli',
    platform: 'node',
    presets: [test()],
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

Node loads the file itself, its types stripped, so it needs no build. A file that is missing, does not load, or declares no kind is the Config pass's finding `config/project-declared`, and every other pass reads it as no settings at all, the `node` profile and the base preset alone. A workspace member keeps its own beside its `package.json`, declaring its own kind and platform.

### Kind and platform

The two closed lists, and which platforms each kind runs on, are [Getting started](../start/getting-started.md#1-declare-what-the-project-is)'s table. What follows from them:

| Follows from | What                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the platform | the oxlint profile ([Lint presets](lint-presets.md#the-profiles)), the tsconfig preset, the roots its framework imposes, the Astro pass — at the root and in each workspace member that declares `astro`                                                     |
| the kind     | the rows of the matrix below; beside them, whether its manual owes the release guide of a published package (a library or a cli whose manifest is not `private`); for a `workspace`, that each member declares its own and the root keeps no `tsconfig.json` |

The matrix is generated from the declaration the toolchain reads, and its last two columns from the specs: each kind is proven by a specimen under `specs/kinds/<kind>/`, a small project written as a person writes one, into which the cli specs install both packed packages — `@jterrazz/typescript` and `@jterrazz/test` — and run the gestures it names. A kind declared without its specimen fails the self corpus.

<!-- GENERATED:kinds -->

| Kind        | Platforms                                                  | Publication                 | Config refuses a manifest that                         | Publish pass             | Specimen                           | Gestures it proves                                                       |
| ----------- | ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------ | ------------------------ | ---------------------------------- | ------------------------------------------------------------------------ |
| `library`   | `node`, `bun`, `react`, `next`, `astro`, `expo`, `browser` | published, unless `private` | publishes no `exports`                                 | judged, unless `private` | `specs/kinds/library/` on `node`   | `typescript fix`, `typescript build`, `typescript check`, `vitest --run` |
| `api`       | `node`, `bun`                                              | private                     | is not `private`, so npm would publish the application | —                        | `specs/kinds/api/` on `node`       | `typescript fix`, `typescript build`, `typescript check`, `vitest --run` |
| `cli`       | `node`, `bun`                                              | published, unless `private` | names no `bin`                                         | judged, unless `private` | `specs/kinds/cli/` on `node`       | `typescript fix`, `typescript build`, `typescript check`, `vitest --run` |
| `website`   | `react`, `next`, `astro`, `browser`                        | private                     | is not `private`, so npm would publish the application | —                        | `specs/kinds/website/` on `react`  | `typescript fix`, `typescript check`, `vitest --run`                     |
| `mobile`    | `expo`                                                     | private                     | is not `private`, so npm would publish the application | —                        | `specs/kinds/mobile/` on `expo`    | `typescript build`, `typescript fix`, `typescript check`, `vitest --run` |
| `workspace` | none — each member its own                                 | members                     | —                                                      | —                        | `specs/kinds/workspace/` on `node` | `typescript fix`, `npm run build`, `typescript check`, `npm test`        |

<!-- /GENERATED:kinds -->

An `api`, a `website` and a `mobile` app owe the same — an application nobody installs — and on purpose the kind derives only one thing more between them, the mobile specs a mutation run leaves out ([The standard](#the-standard)): what differs is their platform's, which already picks the profile, the tsconfig preset and the framework's roots. The kind names what the project is, so a reader and a per-kind proof can tell them apart.

The kind table names toolchain shapes, never products, and a product that fits none of them declares the nearest, not a new kind:

- `api` is any private application process, a service or a one-shot job alike.
- A private `library` is a module a host loads by `main`: an editor extension or a browser plugin. Its manifest names `exports` or `main`.
- A repository whose product is written in another language declares the kind of its TypeScript harness, `private`: a Go product tested by a TypeScript suite is a private `cli`.
- A renderer (a Remotion video) declares the kind whose tooling it uses, a `website` for a scene built with React.
- A project sets `"type": "module"`, which `config/manifest-is-a-module` asks of every manifest: the vitest config the toolchain derives and the names its build gives the files are ESM's, and a package without it fails in both with no word of why. Another top-level key than the ones npm and the family's tools read is refused by `config/manifest-keys-known`, since a typo of a real key reads nothing.
- A project that holds sources and `workspaces` at once is refused by `config/kind-matches-manifest`: its own sources would be read as a member of itself. Its members go under `apps/` of a repository declared a `workspace`.

A `workspace` declares no platform: its root `oxlint.config.ts` lints each member by the platform that member declares, the member's own profile and presets scoped to its folder, so one config serves a React website and a Node api side by side. A member keeps no `oxlint.config.ts` or `oxfmt.config.ts` of its own — a nested one would replace the root's in its subtree — and keeps its own `tsconfig.json`, derived from its platform.

A unit runs on one platform, and a folder of it may run on another: an api on `bun` that serves its own React UI from `web/`. `typescript.platforms` names that folder, from the unit, with the platform it runs on and why, and the unit's `oxlint.config.ts` lints it by that platform's profile — its plugins, its rules, the unit's presets and own rules on top — while the rest of the unit keeps its own:

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'api',
    platform: 'bun',
    typescript: {
        platforms: {
            web: {
                platform: 'react',
                reason: 'the console UI, a React tree vite builds for the api to serve',
            },
        },
    },
});
```

The folder still compiles under the unit's `tsconfig.json`, so how it spells an import — `import/extensions`, which module resolution decides — stays the unit's. A path that is no folder of the unit (a glob, `..`), a platform outside the list and a folder with no reason are refused where the settings are read.

A `library` or a `cli` whose manifest says `"private": true` is not published: a workspace's internal package its siblings import through `workspace:*`, or a binary its repository compiles and installs itself. The Publish pass leaves it, its manual owes no release guide, and a private `cli` owes no `bin`; a private `library` still names its `exports`, which is how its siblings import it.

A workspace's own suite — the tests of the whole repository, owned by no member — is the member at `specs/`, and it is the one unit that declares no kind: `defineConfig({ platform: 'node', presets: [...] })`, on `node` or `bun`, its manifest `private`. It is no product, so no kind's standard applies to it; its platform derives its `tsconfig.json` and its profile, and its presets the rest. A declaration with a platform and no kind anywhere else is `config/project-declared`.

## Presets

A package hands a project everything it holds it to in one preset: its lint rules, its import boundaries, its rules of where a name sits, its debt, and the defaults of its settings section. A project lists the presets it takes under `presets`, and nothing is discovered from `node_modules`: an installed package judges nothing until the project names its preset, so what a project is held to is read in one file.

Each pass then reads the resolved settings and holds the project to all of them. A preset's layer prints as `architecture/<name>` and its name rule as `names/<name>`, with the lesson the package wrote.

A settings file that cannot be resolved, such as a `presets` that is not a list of presets, fails the two passes that read it, each in its own words. The Architecture pass prints a bare four-part refusal, with no rule id, because it judged no layer; the Names pass, which reads `typescript.roots`, prints it as the finding `names/jterrazz-config-loads`:

```text
 RUN  Architecture (layer map)
found: jterrazz.config.ts does not load — … · why: … · fix: correct jterrazz.config.ts until it loads … · read: docs/reference/configuration.md#the-merge-order

 RUN  Names (tree)
jterrazz.config.ts:1:1: error names(jterrazz-config-loads): found: `jterrazz.config.ts` does not load — … · why: … · fix: … · read: docs/reference/configuration.md#the-merge-order
```

A preset is an object carrying its `name` (the section of `jterrazz.config.ts` it reads, and the prefix of its laws), its `package`, and what it adds:

| Key           | Holds                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings`    | the defaults of its section, which the project's own section merges over                                                                                              |
| `lawSettings` | the keys of its `settings` that are laws, which nothing merges over                                                                                                   |
| `oxlint`      | its oxlint config: a JS plugin and its rules, overrides                                                                                                               |
| `layers`      | its import boundaries, in the vocabulary of [the Architecture pass](quality-checks.md#the-architecture-layer-map-pass)                                                |
| `names`       | its rules of where a name sits, in ls-lint's ([a name rule](quality-checks.md#a-name-rule-a-project-declares))                                                        |
| `files`       | the editor files it derives, each with its exact content and whether it sits at the repository root or in every unit                                                  |
| `baseline`    | the sections of `.jterrazz/baseline.json` it writes and judges                                                                                                        |
| `checker`     | its own checks: the `module` whose default export is a kit `Contribution`, and the `label` they print under ([A preset's checks](quality-checks.md#a-presets-checks)) |
| `entries`     | the paths it loads by name, read from its resolved section, which knip takes as entries ([Unused code](lint-presets.md#unused-code-knip))                             |
| `presets`     | the presets it includes                                                                                                                                               |

`definePreset`, from `@jterrazz/typescript/config`, types one. Writing the rules a preset carries is [Rules kit](rules-kit.md)'s.

### The standard

The toolchain's own preset is always on, and nobody names it: it is this package's standard, the data under `src/standard/` — `standard.ts` for every project, `kinds/<kind>.ts` for its kind, `platforms/<platform>.ts` for its platform, `dependencies/<package>.ts` for each package its `package.json` declares that the toolchain knows a property of — merged in that order for the project's declaration. A workspace, and a project that declares nothing, read the `node` platform's. What the standard holds:

- the root spine, the member roots, the roots a tool imposes and the three word rosters of the Names pass ([Quality checks](quality-checks.md#the-names-tree-pass)), with what the platform's code is — its source roots, its extensions, its tsconfig preset, its framework's roots;
- what a platform's runtime imposes: an `expo` app runs on Hermes, which implements no `Array#toSorted` nor `toReversed`, so `unicorn/no-array-sort` and `unicorn/no-array-reverse` are off there — their fixes would write a call that throws at launch — and its tsconfig preset stops `lib` at ES2022, so the type check refuses those calls; a `bun` unit's preset types `Bun` beside Node; `assets/` is a tool root on `expo` and `astro`, the images and authored pages the app imports or serves by path;
- what a package the project depends on imposes: under `@prisma/client`, a batch `$transaction` takes the lazy `PrismaPromise`s its queries return, so `typescript/promise-function-async` is off in the hexagonal persistence folder, `src/infrastructure/outbound/persistence/`; under `patch-package`, `patches/` is a tool root; under `@astrojs/check` and `appium-xcuitest-driver`, knip is told what loads them — the Astro pass spawns `astro check`, Appium loads its driver by name; under `@astrojs/react`, the sources the mutation run mutates take `.tsx` beside `.ts`, the islands of the site being code like any other;
- what a kind owes by default: an api's `src/index.ts` and a cli's `src/*.bin.ts` decide how the process ends, and a library — the one kind that ships a `lint/` tree and a standard of its own — keeps the direction of `lint/` (`kit-knows-no-declaration`, `consumer-folders-apart`, `self-folders-apart`, `catalogue-at-the-bottom`, `shipped-lint-reads-no-self` and `src-reads-no-declaration`, layers the Architecture pass holds its `lint/` tree to, [Architecture](../concepts/architecture.md#the-judging-layer)) and the folders of that tree, has its `lint/` measured by mutation testing, and leaves its `src/standard/` out of it, data with no decision a test could hold. A mobile app's mutation runs leave out its `specs/mobile/**`: those specs drive a real simulator, and a run would open a device session for every mutant, minutes each, and leave the machine its WebDriverAgent processes and simulator windows.

A standard is written as the settings file it defaults is, typed by `defineStandard` from `@jterrazz/typescript/config`, and it is data only: a function, a branch, a call but the `defineStandard` it exports, or a variable under a package's `src/standard/` is the Config pass's finding `config/standard-is-data` ([The Config (one file) pass](quality-checks.md#the-config-one-file-pass)). The code that applies it — the merge, the conventions the build reads names by — lives elsewhere. Every package of the family keeps its own there: `@jterrazz/test`'s `src/standard/standard.ts` holds the defaults of its `test` section, and its `test()` preset hands them on as they are.

A law whose `from` names no file of the project costs nothing: the Architecture pass drops it before it runs, so a library without a `lint/` tree runs no cruise for its kind's laws.

### The merge order

Resolution is deterministic, and the same in every reader:

1. The standard first — `standard.ts`, then the kind's, then the platform's, then each declared dependency's — then each listed preset in the order written, then the project's own file. A preset's own presets come before it, depth first, and a preset named twice keeps its first place. Two presets of one name from two packages are refused.

2. Each section is its presets' `settings` merged in that order, then the project's own section over them. A list concatenates with duplicates dropped, a record merges key by key, and a single value the project writes wins. A list or a record is never replaced by another shape, so a `null` or a string written over the root spine is refused: a default is added to, never written away. A setting a preset names in its `lawSettings` is a law, and nothing adds to it. The standard's are the root spine, the member roots, the tool roots, the word rosters, what the platform's code is and, for a library, the lint tree; a root the project keeps beside the root spine is declared under `typescript.roots` with its reason.
3. The laws, `layers` and `names`, are every preset's in that order, then the project's own (`typescript.architecture.layers`, `typescript.names`).
4. `oxlint` is the platform's profile, then every preset's config in that order, then the project's own `typescript.oxlint` ([the lint rules](#the-lint-rules)).

`typescript doctor` prints the resolved settings, one per line, each beside the file it comes from — a file of a package's standard, a preset, or `jterrazz.config.ts` — then every law and every one set aside. The oxlint config shows whole: the rulebook's profile for the platform — its rules, JS plugins and overrides —, each preset's fragment, then the project's own rules and overrides. A rule shows on one line beside the last of them that sets it, since its level and options are one value a later layer replaces whole. What no file states shows too, beside `derived from the tree`: the build entries read off module names, and what a preset derives — `@jterrazz/test`'s test projects. An empty list or record a standard states shows as `[]` or `{}` until a file fills it.

A file that does not load, a `presets` that is not a list of presets, a section that is not an object, a setting that replaces a default's shape, a write to a law setting, or a `presets` written inside a section rather than at the top level is refused in four parts by the pass that reads it, reading this heading.

### Setting a law aside

A project cannot drop a preset's law by writing over it. It sets one aside in the open, under `optOuts`, naming the law as `<preset>/<rule>` and saying why:

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    optOuts: {
        'typescript/self-folders-apart': 'the corpus reads a check it audits, until it moves',
    },
    platform: 'node',
});
```

An opt-out with no reason, or one naming a law no preset declares, is refused like a file that does not load. Each one is counted: the drift report prints how many laws the project set aside, and which ([Quality checks](quality-checks.md#the-drift-report)).

### A repository held to its own presets

A package that ships a preset holds itself to it, from its own build: `ownPresets` maps each built module to the preset it exports.

```ts
// jterrazz.config.ts
import { defineConfig, ownPresets } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: ownPresets(import.meta.url, {
        './dist/config.js': 'test',
        './.artifacts/dev/preset.js': 'self',
    }),
});
```

`typescript build` reads the file before the build exists, so it runs on none of them; every other command is refused in four parts, reading this section, until `npm run build` made them — a run without them would judge nothing they hold. `ownPresets` loads them synchronously: the oxlint rules read the settings file synchronously, and a file holding a top-level `await` is one they cannot load — the Config pass refuses it (`config/settings-load-synchronously`).

## The `typescript` section

The section this package reads holds what the project cannot derive from its tree, its kind or its platform: the exceptions to its standard, every one of them a name or a path mapped to the reason it is there. The drift report counts them ([Quality checks](quality-checks.md#the-drift-report)).

| Setting        | Declares                                                                                                                                                                                                                                                                                                                 | Read by                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `roots`        | each folder the repository keeps beside the root spine, mapped to its reason; written `{ reason, verbatim: true }`, a folder is kept as written by the formatter, the Markdown pass, the Comments pass and the Names pass: quoted upstream text, signed articles, a script's output                                      | [the Names pass](quality-checks.md#a-root-beside-the-spine)                |
| `architecture` | the layer map its imports are held to: the shipped `hexagonal` map — derived where `src/` is laid out hexagonally —, its own `layers`, or both                                                                                                                                                                           | [the Architecture pass](quality-checks.md#the-architecture-layer-map-pass) |
| `names`        | its own rules of where a name sits                                                                                                                                                                                                                                                                                       | [the Names pass](quality-checks.md#a-name-rule-a-project-declares)         |
| `oxlint`       | the rules it sets apart from its profile, `rules` and `overrides`                                                                                                                                                                                                                                                        | [the lint rules](#the-lint-rules)                                          |
| `tsconfig`     | `compilerOptions`, `include` and `files` the project adds to its platform's preset, with one `reason` — an `include` is written beside the preset's globs, never in their place, and `files` names one file outside them (an ambient `.d.ts` under `node_modules/`, which the preset's `exclude` would drop from a glob) | the derived `tsconfig.json`                                                |
| `oxfmt`        | `ignore`: the paths the formatter leaves as written                                                                                                                                                                                                                                                                      | the derived `oxfmt.config.ts`                                              |
| `knip`         | `entry`, `ignore`, `ignoreBinaries`, `ignoreDependencies`: what knip cannot trace                                                                                                                                                                                                                                        | [Lint presets](lint-presets.md#unused-code-knip)                           |
| `mutation`     | `mutate`: sources measured beyond the platform's and the kind's; `exclude`: tests mutation runs leave out; `ignore`: sources it never mutates                                                                                                                                                                            | [Quality checks](quality-checks.md#mutation)                               |

A project with nothing of its own to say keeps no section at all.

## The tsconfig presets

Every preset scopes its `include` and `exclude` to `${configDir}`, the directory of the `tsconfig.json` that extends it, so a project inherits the right file set without restating one. Every preset checks and never emits, compiles incrementally into `.artifacts/tsc/`, and allows an import that names a `.ts` file: Node runs a module that way, and the check reads it as Node does. The declarations a library publishes are emitted by the build, never by `tsc`, so a library and a service on one platform share one preset ([Building](building.md)).

The `browser` preset is `react`'s without its JSX transform: the DOM's libraries and bundler resolution, for a page or an extension that runs plain DOM code — a `.tsx` component test included, which renders without JSX.

No preset declares a `paths` alias. An import is relative (`../domain/order.js`) on every platform, `next` and `astro` included: the `@/*` alias of their starter templates is one more resolution every tool of the chain must be taught — the bundler, the test runner, the dead-code reader — for a shorter line. Two repositories dropped it and rewrote 218 imports without losing a line of behaviour.

The `node` preset reads `.tsx` too, with React's automatic JSX transform: a Node package rendering components — its server, or its component tests under `@jterrazz/test` — needs no option of its own for them.

The `astro` preset stands on Astro's own. It extends `astro/tsconfigs/strict` first, for the file set Astro's tooling needs, `.astro/types.d.ts` included, then states this package's settings on top. `astro` is the project's dependency, never this package's: an Astro site already installs it, and the `extends` resolves it from the project's `node_modules`.

## The lint rules

A project's lint config is derived: the profile of its platform, then what each preset declares, in [the merge order](#the-merge-order). A rule the project sets apart from that is written under `typescript.oxlint`, with the reason it is set apart — the drift report counts each one ([Quality checks](quality-checks.md#the-drift-report)):

```ts
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'cli',
    platform: 'node',
    typescript: {
        oxlint: {
            rules: {
                'no-console': { level: 'off', reason: 'a command prints to its terminal' },
            },
        },
    },
});
```

A set of files judged apart is an override, which names its files and its reason beside the rules:

```ts
const generated = {
    files: ['src/generated/**'],
    reason: "the generated client keeps the API's names",
    rules: { 'unicorn/filename-case': 'off' },
};
```

written as `typescript: { oxlint: { overrides: [generated] } }`.

A rule written with no `{ level, reason }`, or an override with no `files` or no `reason`, is refused in four parts by every reader — `check`, `fix`, and the editor loading `oxlint.config.ts` — reading this page. A path left out of the linter alone is the [Quality checks § Leaving a path out](quality-checks.md#leaving-a-path-out)'s.
