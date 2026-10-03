# Configuration

What a project says about itself, and where it says it. Most projects stop at the three files of [Getting started](05-getting-started.md); this chapter is for the day one has something of its own to declare.

| File                 | Holds                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `jterrazz.config.ts` | the presets the project is held to, and its own settings, one section per package                                      |
| `tsconfig.json`      | one `extends` line, naming the tsconfig preset of its profile                                                          |
| `oxlint.config.ts`   | `fromPresets(settings)`, and what the project adds to the lint rules it is handed                                      |
| `oxfmt.config.ts`    | the shared formatting, `base`                                                                                          |
| `knip.json`          | only an override of the unused-code preset, each with its reason ([Lint presets](08-lint-presets.md#unused-code-knip)) |

## The settings file

`jterrazz.config.ts` is the one settings file of the `@jterrazz` family. This package owns it and types it: `defineConfig` knows every section a package of the family declares, and each package reads only its own.

```ts
// jterrazz.config.ts
import { test } from '@jterrazz/test/config';
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({
    presets: [typescript({ profile: 'node' }), test()],
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

Node loads the file itself, its types stripped, so it needs no build. A missing file is no settings at all, and the project is held to the base preset alone on the `node` profile. A file that does not load, or holds no settings object, is a finding of the pass that reads it. A workspace member keeps its own beside its `package.json`, for what that member alone declares.

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
| `baseline`    | the sections of `jterrazz.baseline.json` it writes and judges                                                                                                            |
| `floors`      | which of those sections hold a floor, which only rises, rather than a debt                                                                                               |
| `checker`     | its own checks: the `module` whose default export is a kit `Contribution`, and the `label` they print under ([A preset's checks](07-quality-checks.md#a-presets-checks)) |
| `presets`     | the presets it includes                                                                                                                                                  |

`definePreset`, from `@jterrazz/typescript/config`, types one. Writing the rules a preset carries is [Rules kit](10-rules-kit.md)'s.

### The base preset

`typescript()` is always on, whether the file names it or not. Naming it chooses its `profile`, the oxlint profile `fromPresets` starts from, `node` where none is named. It carries the laws every repository of the family keeps:

- the direction of `lint/`: `kit-knows-no-declaration`, `consumer-folders-apart`, `self-folders-apart`, `catalogue-at-the-bottom`, `shipped-lint-reads-no-self` and `src-reads-no-declaration`, layers the Architecture pass holds a `lint/` tree to wherever one stands ([Architecture](01-architecture.md#the-judging-layer));
- the folders of the lint tree, the root spine, the roots a tool imposes, and the three word rosters of the Names pass ([Quality checks](07-quality-checks.md#the-names-tree-pass)).

A law whose `from` names no file of the project costs nothing: the Architecture pass drops it before it runs, so a repository without a `lint/` tree runs no cruise for the base preset's laws.

### The merge order

Resolution is deterministic, and the same in every reader:

1. The base preset first, then each listed preset in the order written. A preset's own presets come before it, depth first, and a preset named twice keeps its first place. Two presets of one name from two packages are refused.

    Writing `typescript({ profile: 'next' })` adds no second base preset. It only sets the base preset's settings — the profile here — merged over its defaults wherever it is met, at the top level or inside another preset; the laws, the baseline and the floors stay the base preset's own.

2. Each section is its presets' `settings` merged in that order, then the project's own section over them. A list concatenates with duplicates dropped, a record merges key by key, and a single value the project writes wins. A list or a record is never replaced by another shape, so a `null` or a string written over the root spine is refused: a default is added to, never written away. A setting a preset names in its `lawSettings` is a law, and nothing adds to it. The base preset's are the lint tree, the root spine, the member roots, the tool roots and the word rosters; a root the project keeps beside the root spine is declared under `typescript.roots` with its reason.
3. The laws, `layers` and `names`, are every preset's in that order, then the project's own (`typescript.architecture.layers`, `typescript.names`).
4. `oxlint` is every preset's config, composed by `compose` in that order after the base profile.

A file that does not load, a `presets` that is not a list of presets, a section that is not an object, a setting that replaces a default's shape, a write to a law setting, or a `presets` written inside a section rather than at the top level is refused in four parts by the pass that reads it, reading this heading.

### Setting a law aside

A project cannot drop a preset's law by writing over it. It sets one aside in the open, under `optOuts`, naming the law as `<preset>/<rule>` and saying why:

```ts
// jterrazz.config.ts
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({
    optOuts: {
        'typescript/self-folders-apart': 'the corpus reads a check it audits, until it moves',
    },
    presets: [typescript()],
});
```

An opt-out with no reason, or one naming a law no preset declares, is refused like a file that does not load. Each one is counted: the drift report prints how many laws the project set aside, and which ([Quality checks](07-quality-checks.md#the-drift-report)).

## The `typescript` section

The section this package reads holds three settings of the project's own:

| Setting        | Declares                                                                                      | Judged by                                                                     |
| -------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `roots`        | each folder the repository keeps beside the root spine, mapped to its reason                  | [the Names pass](07-quality-checks.md#a-root-beside-the-spine)                |
| `architecture` | the layer map its imports are held to: the shipped `hexagonal` map, its own `layers`, or both | [the Architecture pass](07-quality-checks.md#the-architecture-layer-map-pass) |
| `names`        | its own rules of where a name sits                                                            | [the Names pass](07-quality-checks.md#a-name-rule-a-project-declares)         |

A project on the `node` profile with nothing of its own to say keeps no section at all.

## The tsconfig presets

Every preset scopes its `include` and `exclude` to `${configDir}`, the directory of the `tsconfig.json` that extends it, so a project inherits the right file set without restating one. Every preset checks and never emits, compiles incrementally into `.artifacts/tsc/`, and allows an import that names a `.ts` file: Node runs a config that way, `oxlint.config.ts` importing `./jterrazz.config.ts`, and the check reads it as Node does.

`node` keeps `allowJs` on and `library` turns it off. A service may still carry a `.js` file, and the rulebook scopes decisions to `**/*.js` for it ([Lint presets](08-lint-presets.md#the-profiles)); a published package emits its declarations without a type-checker, which cannot be done from JavaScript.

The `astro` preset stands on Astro's own. It extends `astro/tsconfigs/strict` first, for the file set Astro's tooling needs, `.astro/types.d.ts` included, then states this package's settings on top. `astro` is the project's dependency, never this package's: an Astro site already installs it, and the `extends` resolves it from the project's `node_modules`.

## The lint config

A project's oxlint config is what its presets declare: `fromPresets(settings)` composes the profile of the base preset, then each preset's own rules in [the merge order](#the-merge-order). A project that keeps no `oxlint.config.ts` is handed that same composition by `check`; it keeps one to add what is its own, composed after with `compose()` ([Lint presets](08-lint-presets.md#compose-semantics)):

```ts
// oxlint.config.ts
import { compose, defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

export default defineConfig(
    compose(fromPresets(settings), {
        ignorePatterns: ['generated/**'],
        rules: {
            'unicorn/filename-case': 'off', // reason: the generated client keeps the API's names
        },
    }),
);
```

A rule the profile has on and the project turns off carries a `// reason:` on the line that turns it off, or the drift report refuses it ([Quality checks](07-quality-checks.md#the-drift-report)). `ignorePatterns` leaves a path out of the linter alone; the other ways to leave one out are [Quality checks § Leaving a path out](07-quality-checks.md#leaving-a-path-out)'s.

### A subtree on another profile

A workspace whose members share one profile needs one root config. A subtree that is another shape, such as a React client inside a Node service, takes a nested `oxlint.config.ts` of its own, which oxlint applies to that subtree, declaring the presets that subtree is held to, its own profile first. Linter options belong to the root config alone, and the root's already turn type information on for the whole tree, so the nested file passes its composition through `nested()`:

```ts
// client/oxlint.config.ts
import { test } from '@jterrazz/test/config';
import { typescript } from '@jterrazz/typescript/config';
import { defineConfig, fromPresets, nested } from '@jterrazz/typescript/oxlint';

export default defineConfig(
    nested(fromPresets({ presets: [typescript({ profile: 'react' }), test()] })),
);
```
