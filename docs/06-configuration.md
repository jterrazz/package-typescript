# Configuration

What a project says about itself, and where it says it. Most projects stop at the three files of [Getting started](05-getting-started.md); this chapter is for the day one has something of its own to declare.

| File                 | Holds                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `jterrazz.config.ts` | what the project is — its `kind` and `platform` — the presets it is held to, and every setting, with its reason |
| `tsconfig.json`      | one `extends` line, derived from the platform                                                                   |
| `oxlint.config.ts`   | derived from its folder                                                                                         |
| `oxfmt.config.ts`    | derived from its folder                                                                                         |
| `.jterrazz/`         | the debt the ratchet holds, tracked, and gone when it is paid ([the ratchet](07-quality-checks.md#the-ratchet)) |

The three derived files are an editor's, which reads its tools' configs from fixed names, and they say nothing of their own: `typescript fix` writes them, and the [Config (one file) pass](07-quality-checks.md#the-config-one-file-pass) refuses one that says anything else. Every other tool — knip, the build, mutation testing — is configured by the command that runs it, from the same file, and keeps no config at the root.

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

The two closed lists, and which platforms each kind runs on, are [Getting started](05-getting-started.md#1-declare-what-the-project-is)'s table. What follows from them:

| Follows from | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the platform | the oxlint profile ([Lint presets](08-lint-presets.md#the-profiles)), the tsconfig preset, the roots its framework imposes, the Astro pass — at the root and in each workspace member that declares `astro`                                                                                                                                                                                                                                                                                       |
| the kind     | what the manifest holds — a library its `exports` or `main`, a cli its `bin`, an `api`, `website` or `mobile` app `"private": true`; whether the [Publish pass](07-quality-checks.md#the-publish-packaging-pass) judges it (a library or a cli) whether its manual owes the operating chapter of a published package (a library or a cli), and knip reads its exports as a public surface (a library); for a `workspace`, that each member declares its own and the root keeps no `tsconfig.json` |

An `api`, a `website` and a `mobile` app owe the same — an application nobody installs — and on purpose the kind derives nothing more between them: what differs is their platform's, which already picks the profile, the tsconfig preset and the framework's roots. The kind names what the project is, so a reader and a per-kind proof can tell them apart.

A `workspace` declares no platform: its root `oxlint.config.ts` lints each member by the platform that member declares, the member's own profile and presets scoped to its folder, so one config serves a React website and a Node api side by side. A member keeps no `oxlint.config.ts` or `oxfmt.config.ts` of its own — a nested one would replace the root's in its subtree — and keeps its own `tsconfig.json`, derived from its platform.

## Presets

A package hands a project everything it holds it to in one preset: its lint rules, its import boundaries, its rules of where a name sits, its debt, and the defaults of its settings section. A project lists the presets it takes under `presets`, and nothing is discovered from `node_modules`: an installed package judges nothing until the project names its preset, so what a project is held to is read in one file.

Each pass then reads the resolved settings and holds the project to all of them. A preset's layer prints as `architecture/<name>` and its name rule as `names/<name>`, with the lesson the package wrote.

A settings file that cannot be resolved, such as a `presets` that is not a list of presets, fails the two passes that read it, each in its own words. The Architecture pass prints a bare four-part refusal, with no rule id, because it judged no layer; the Names pass, which reads `typescript.roots`, prints it as the finding `names/jterrazz-config-loads`:

```text
 RUN  Architecture (layer map)
found: jterrazz.config.ts does not load — … · why: … · fix: correct jterrazz.config.ts until it loads … · read: docs/06-configuration.md#the-merge-order

 RUN  Names (tree)
jterrazz.config.ts:1:1: error names(jterrazz-config-loads): found: `jterrazz.config.ts` does not load — … · why: … · fix: … · read: docs/06-configuration.md#the-merge-order
```

A preset is an object carrying its `name` (the section of `jterrazz.config.ts` it reads, and the prefix of its laws), its `package`, and what it adds:

| Key           | Holds                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `settings`    | the defaults of its section, which the project's own section merges over                                                                                                 |
| `lawSettings` | the keys of its `settings` that are laws, which nothing merges over                                                                                                      |
| `oxlint`      | its oxlint config: a JS plugin and its rules, overrides                                                                                                                  |
| `layers`      | its import boundaries, in the vocabulary of [the Architecture pass](07-quality-checks.md#the-architecture-layer-map-pass)                                                |
| `names`       | its rules of where a name sits, in ls-lint's ([a name rule](07-quality-checks.md#a-name-rule-a-project-declares))                                                        |
| `files`       | the editor files it derives, each with its exact content and whether it sits at the repository root or in every unit                                                     |
| `baseline`    | the sections of `.jterrazz/baseline.json` it writes and judges                                                                                                           |
| `floors`      | which of those sections hold a floor, which only rises, rather than a debt                                                                                               |
| `checker`     | its own checks: the `module` whose default export is a kit `Contribution`, and the `label` they print under ([A preset's checks](07-quality-checks.md#a-presets-checks)) |
| `presets`     | the presets it includes                                                                                                                                                  |

`definePreset`, from `@jterrazz/typescript/config`, types one. Writing the rules a preset carries is [Rules kit](10-rules-kit.md)'s.

### The base preset

The toolchain's own preset is always on, and nobody names it: the declaration derives it, its profile the platform's, its editor files and its tool roots the platform's too. It carries the laws every repository of the family keeps:

- the direction of `lint/`: `kit-knows-no-declaration`, `consumer-folders-apart`, `self-folders-apart`, `catalogue-at-the-bottom`, `shipped-lint-reads-no-self` and `src-reads-no-declaration`, layers the Architecture pass holds a `lint/` tree to wherever one stands ([Architecture](01-architecture.md#the-judging-layer));
- the folders of the lint tree, the root spine, the roots a tool imposes, and the three word rosters of the Names pass ([Quality checks](07-quality-checks.md#the-names-tree-pass)).

A law whose `from` names no file of the project costs nothing: the Architecture pass drops it before it runs, so a repository without a `lint/` tree runs no cruise for the base preset's laws.

### The merge order

Resolution is deterministic, and the same in every reader:

1. The base preset the declaration derives first, then each listed preset in the order written. A preset's own presets come before it, depth first, and a preset named twice keeps its first place. Two presets of one name from two packages are refused.

2. Each section is its presets' `settings` merged in that order, then the project's own section over them. A list concatenates with duplicates dropped, a record merges key by key, and a single value the project writes wins. A list or a record is never replaced by another shape, so a `null` or a string written over the root spine is refused: a default is added to, never written away. A setting a preset names in its `lawSettings` is a law, and nothing adds to it. The base preset's are the lint tree, the root spine, the member roots, the tool roots and the word rosters; a root the project keeps beside the root spine is declared under `typescript.roots` with its reason.
3. The laws, `layers` and `names`, are every preset's in that order, then the project's own (`typescript.architecture.layers`, `typescript.names`).
4. `oxlint` is the platform's profile, then every preset's config in that order, then the project's own `typescript.oxlint` ([the lint rules](#the-lint-rules)).

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

An opt-out with no reason, or one naming a law no preset declares, is refused like a file that does not load. Each one is counted: the drift report prints how many laws the project set aside, and which ([Quality checks](07-quality-checks.md#the-drift-report)).

## The `typescript` section

The section this package reads holds the project's own settings, every one of them a name or a path mapped to the reason it is there:

| Setting        | Declares                                                                                                                       | Read by                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `roots`        | each folder the repository keeps beside the root spine                                                                         | [the Names pass](07-quality-checks.md#a-root-beside-the-spine)                |
| `architecture` | the layer map its imports are held to: the shipped `hexagonal` map, its own `layers`, or both                                  | [the Architecture pass](07-quality-checks.md#the-architecture-layer-map-pass) |
| `names`        | its own rules of where a name sits                                                                                             | [the Names pass](07-quality-checks.md#a-name-rule-a-project-declares)         |
| `oxlint`       | the rules it sets apart from its profile, `rules` and `overrides`                                                              | [the lint rules](#the-lint-rules)                                             |
| `tsconfig`     | `compilerOptions` and `include` the project adds to its platform's preset, with one `reason`                                   | the derived `tsconfig.json`                                                   |
| `oxfmt`        | `ignore`: the paths the formatter leaves as written                                                                            | the derived `oxfmt.config.ts`                                                 |
| `build`        | `entries` the manifest does not name, and `dev` scripts built for the repository itself                                        | [Building](09-building.md#the-entries)                                        |
| `knip`         | `entry`, `ignore`, `ignoreBinaries`, `ignoreDependencies`: what knip cannot trace                                              | [Lint presets](08-lint-presets.md#unused-code-knip)                           |
| `mutation`     | `mutate`: sources measured beyond the platform's; `exclude`: tests mutation runs leave out; `ignore`: sources it never mutates | [Quality checks](07-quality-checks.md#mutation)                               |

A project with nothing of its own to say keeps no section at all.

## The tsconfig presets

Every preset scopes its `include` and `exclude` to `${configDir}`, the directory of the `tsconfig.json` that extends it, so a project inherits the right file set without restating one. Every preset checks and never emits, compiles incrementally into `.artifacts/tsc/`, and allows an import that names a `.ts` file: Node runs a module that way, and the check reads it as Node does. The declarations a library publishes are emitted by the build, never by `tsc`, so a library and a service on one platform share one preset ([Building](09-building.md)).

The `node` preset reads `.tsx` too, with React's automatic JSX transform: a Node package rendering components — its server, or its component tests under `@jterrazz/test` — needs no option of its own for them.

The `astro` preset stands on Astro's own. It extends `astro/tsconfigs/strict` first, for the file set Astro's tooling needs, `.astro/types.d.ts` included, then states this package's settings on top. `astro` is the project's dependency, never this package's: an Astro site already installs it, and the `extends` resolves it from the project's `node_modules`.

## The lint rules

A project's lint config is derived: the profile of its platform, then what each preset declares, in [the merge order](#the-merge-order). A rule the project sets apart from that is written under `typescript.oxlint`, with the reason it is set apart — the drift report counts each one ([Quality checks](07-quality-checks.md#the-drift-report)):

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

A rule written with no `{ level, reason }`, or an override with no `files` or no `reason`, is refused in four parts by every reader — `check`, `fix`, and the editor loading `oxlint.config.ts` — reading this chapter. A path left out of the linter alone is the [Quality checks § Leaving a path out](07-quality-checks.md#leaving-a-path-out)'s.
