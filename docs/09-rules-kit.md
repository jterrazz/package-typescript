# Rules kit

A package of the family that writes rules for its consumers writes them with the engine this toolchain judges itself with. `@jterrazz/typescript/rules` exports that engine, and `@jterrazz/typescript/config` exports the one mechanism by which a package hands its consumers everything it holds them to — the preset. This chapter is both, in the order a rule is written: its row, its message, its check, its chapter, its debt, what it reads, and the preset that carries it.

The kit is `lint/engine/`, exported through `lint/index.rules.ts` ([Architecture](01-architecture.md#the-judging-layer)) — and, under the `browser` condition, through `lint/index.rules.browser.ts`, the half that reads no disk: the lesson, the rule, the table and the ground folders, for a runtime a page loads: nothing in it knows a declaration, so a sibling package reads the same code this package runs, and keeps in its own engine only what no other package reads — `@jterrazz/test` keeps its spec-document model, its facets and its stub kinds, and nothing else.

## A rule is a catalogue row

A rule starts as a row, a `RuleDocs`: its `name`, its `family`, its `audience` (an `Audience` — `consumer` ships, `self` is the package's own discipline), the `sentence` it holds a project to, and the `fix` a reader applies. `rowNamed(rows, name)` finds one and refuses a name no row holds; `byName(rows)` orders a catalogue so a generated chapter is the same from one run to the next.

Every message a rule prints teaches in four parts — `found: … · why: … · fix: … · read: …` — and the kit writes it: the finding states what was found and the fix for this case, the row gives the why (its `why`, or the first sentence of its `sentence`), and the read is the chapter anchor. A `Lesson` is the four parts, an `Unread` the three a judge returns before its caller names the chapter, and a `Teaching` the `found` and `fix` of one case; `Taught` is what a row lends the rest, its `sentence` and its `why`. `refusal(lesson)` writes one line, `refusalBlock(lesson)` one part per line; `lessonOf(row, read, teaching)` writes one case's message, its why `whyOf(row)` — the row's `why`, or `firstSentence(sentence)`. `lessonParts` and `missingParts` read a message back, in the order `LESSON_PARTS` holds, which is how a meta-test refuses a message missing a part. A read is a `ChapterAnchor`, `docs/<chapter>.md#<anchor>`, and `readAt(row, chapter)` writes a row's, a `Chapter` being `docs/<name>.md`.

`defineRule(definition, body)` writes an oxlint JS rule from its row — a `RuleDefinition`: its `docs`, its `messages`, its `read`, a `RuleType` and the `RuleOptions` oxlint reads (`schema`, `defaultOptions`, `fixable`) — and a `RuleBody`, the visitor factory oxlint takes, `create` or `createOnce`:

```ts
import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { ROWS } from '../catalogue/manifest.js';

const row = rowNamed(ROWS, 'no-sleep');
```

The rule is its row, its messages, its read and its visitor:

```ts
export const noSleep = defineRule(
    {
        docs: row,
        messages: {
            slept: { found: '`sleep()` waits on the clock', fix: 'await the event itself' },
        },
        read: readAt(row, 'docs/19-linting.md'),
    },
    {
        createOnce: (context) => ({
            'CallExpression[callee.name="sleep"]': (node) =>
                context.report({ messageId: 'slept', node }),
        }),
    },
);
```

The result is a `DefinedRule`: the body, and a `RuleMeta` whose `docs` is the row and each message its lesson, a `{{data}}` placeholder left for oxlint to fill. `lessonsAt(row, messages, chapter)` is the same composition for a rule that states its `meta` itself, its read the row's anchor in the chapter.

A refusal a package's own code throws is the same four parts. `defineInvariant({ package, bugOf, notOf })` — an `InvariantOwner` — gives a package its `invariant()`, the error only the package itself can cause, whose message says so.

## A cross-file check

What one file cannot show — the tree, the manifest, the manual — is a check. `defineCheck({ docs, namespace, read })` — a `CheckDefinition` — binds a row to its printed id, `<namespace>/<name>`, and the `DefinedCheck`'s `.finding(at, teaching)` returns the finding at its position — a `Located`: a `path`, a `line`, a `column` — with its four-part message. Every check of the family returns that one `Finding`, and `reportLine(finding)` prints it in the compiler's convention, `path:line:column: error <namespace>(<name>): message`, the one every editor's problem matcher reads.

`runChecker({ passes, held, commands })` — a `Checker`: its `Passes`, each a `Pass` whose `check(context)` returns a `PassResult`, the `Held` sections and the `Commands` — is the command line of a set of passes, `checker <pass> [root]`: it reads the arguments (`--fix`, `--format`, a flag's value written apart or as `--flag=value`), hands a pass its `Context` — the project root, its sweep, its settings resolved with the base preset first — prints each finding through `reportLine`, applies its fixes, and judges a pass `held` names against its section of the baseline, printing the section it stands on when it holds (`jterrazz.baseline.json › test: 3 held across 2 rules`). `--format json` prints the findings as JSON instead, each with its `rule`, `path`, `line`, `column` and `message`. A pass counts its findings under its own name, or under the `namespace` it states; a result it marks `deferred` is reported and judged by another run, so it fails only on what stopped it. `commands` are the verbs beside the passes — a recording gesture, a query — each an `EngineCommand`. `readCommandLine(args, valued)` is the reading `runChecker` does, a `CommandLine`, for a command that parses its own. A program that unwinds instead of exiting throws `stop(code)` and reads the code back with `exitCodeOf(program)`.

`presetChecks(root, config)` — a `PresetChecks` — runs the laws resolved settings hold a tree to — the Architecture pass over every preset's `layers` and the repository's own, and each declared `names` rule — with `config` written as a `jterrazz.config.ts` would be, `{ presets, optOuts, typescript: { … } }`, the base preset first: `{}` holds a tree to the base preset alone. It returns their findings, each at its position, and any problem that stopped a pass — a settings object that cannot be resolved included.

### Testing a rule

`@jterrazz/test` is the kit to test what this one writes ([21 — Lint specs](https://github.com/jterrazz/package-test/blob/main/docs/21-lint.md)): `ruleTester()` runs a rule's visitor on snippets, and refuses an invalid case that states no `line` and `column`; `specification.lint()` lints a fixture tree with the real oxlint, a checker's command or the laws of presets, and compares the whole report. A rule is proven where its behaviour lives — its visitor on a snippet, what it says about a tree on a tree.

## A chapter carries its catalogue

A chapter that lists rules carries them between markers and never by hand. A `Projection` is a page, its `Markers` and the `render` that writes the block; `projected(text, page, projections)` splices every block of a page, `writeProjections(projections)` writes only a page whose text changed, and `spliceBetween` refuses a page that lost its markers. `markdownTable` pads a table as the formatter does, so a generated block is format-clean; `cell` escapes a pipe, `anchor(name)` gives a row the anchor its lesson reads, and `anchorsOf(text)` lists every heading and row anchor a page holds.

## The ratchet engine

Debt no linter holds lives in `jterrazz.baseline.json` — `BASELINE` names it — one section per preset ([Quality checks](06-quality-checks.md#what-jterrazzbaselinejson-still-holds)). The kit reads it and writes it: `readBaseline` refuses a file that is not an object of sections of counts (a `ReadBaseline`, its `Sections` each a `Counts`), `sectionOf` reads one, `keepsSection` says whether the file holds one, `labelOf(section)` prints it as `jterrazz.baseline.json › <section>`, and `writeSection` writes one and keeps every other byte of the file, in the indent the file already uses. `countsOf(findings)` counts findings by rule, the shape a section holds. `OXLINT_SUPPRESSIONS` names oxlint's own debt file, which stays in the tool's native format.

Two judges share it. `judgeExact(counts, recorded, { record, lower })` holds debt exactly: a count above its entry, a rule with findings and no entry, a count below its entry and an entry at zero each break it. `tightened` is what `fix` writes — it lowers what fell and drops what reached zero, and never raises an entry nor adds one, so debt that grew is recorded only by the recording gesture. `judgeFloor(now, floor)` holds a measure that only rises, such as coverage: a value below its floor breaks it, and `raisedFloor` records the higher of the two. A judge returns what broke as a `Broken` — the rule and a lesson with no read; the caller writes the chapter it reads in place. A `Ratchet` names the two gestures a judge's lesson points to, `record` and `lower`, and a `HeldSection` is a section a checker judges, with them and its read.

## Reading a project

The readers every check needs are the kit's, so two packages never read one project two ways:

- the sweep: `projectFiles`, the files git does not ignore, `filesUnder(dir)`, the same below one folder, and `ignoredPaths(root, paths)`, which of many paths git ignores, in one call; `PRUNED`, the folders no walk enters; `treeEntries` (each a `TreeEntry`), `treeKind` and `treeNames`, a directory listed as git sees it, cached until the index or the directory changes — `forgetTree` drops that cache, and `folderChanged(folder)` says whether a folder's listing changed since it was last asked;
- the disk as git sees it: `isFile`, `isDirectory`, `listDirectory` and `readFileCached`, and `isOnDisk` for `.git`, which git never lists; `moveKeepingHistory(from, to)` moves a path with `git mv` where it can;
- the source text: `blankComments(text)` turns every comment to spaces and `quotedMask(text)` marks every offset inside a string or a template's text, both from the one lexer the Suppressions pass reads, each `Span` a start and an end on a line — so every offset, line and column still holds;
- the workspace: `workspaceMembers`, found no deeper than `MEMBER_DEPTH`, `readManifest` (a `Manifest`), `workspacePatterns`; the roots: `nearestRoot(from, isRoot)` walks up to the nearest folder `isRoot` holds, `holdsManifest` is a folder with a `package.json`, `isRepositoryRoot` one with a `.git`, and `isProjectRoot` either;
- what a package publishes: `entryPoints`, each output its `exports`, `main` and `bin` publish under `dist/` mapped to the entry it is built from ([Building](05-building.md#the-entries)), and `declaredSubpaths`, the subpaths it declares;
- the tools' own files: `OXLINT_CONFIG_NAMES`, the names oxlint looks for a project's config under, in its order;
- the ground a spec stands on: `GROUND_FOLDERS` — `GROUND_FIXTURES`, `GROUND_EXPECTED`, `GROUND_SEEDS`, `GROUND_REQUESTS`, matched wherever it sits by the glob `GROUND_GLOB`, and a name by `isGroundFolder` — and `RESERVED_FOLDERS`, with `SETUP_FOLDER` and `SHARED_FOLDER`, read by `isReservedFolder`; `UNMARKED_RESERVED` maps each name written without its `_` to the folder it means — one list, which the oxlint and oxfmt presets ignore and every check skips;
- a suppression: `suppressionDirectives(stem)` reads `<stem>-disable-next-line <id> -- reason` and `<stem>-disable-line` (its `SuppressionDirectives`, each a `Directive`), and `holdsDirectives(path)` says which files may carry one;
- the settings: `readSettings(unit)` and `readSettingsSync(unit)`, a unit's `jterrazz.config.ts` resolved through its presets — a `Resolution`: the `problem` that stopped it, if any, and the `Resolved` presets, sections, laws (each a `PresetLaw`, `<preset>/<rule>`), opt-outs and baseline sections.

`@jterrazz/typescript/rules` exports this and nothing more: what the engine keeps beside it — its caches, its merge of settings, its resolver — is its own, so a sibling resolves settings only through the readers above, the base preset always first. The preset's own vocabulary — `definePreset`, `Preset`, `ArchitectureRule`, `NamesRule`, `OptOut` — is `@jterrazz/typescript/config`'s.

## Presets

A package hands its consumers everything it holds them to in ONE preset: an object carrying its `name` — the section of `jterrazz.config.ts` it reads and the prefix of its laws — its `package`, and what it adds:

| Key           | Holds                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `settings`    | the defaults of its section, which the repository's own section merges over                                               |
| `lawSettings` | the keys of its `settings` that are laws, which nothing merges over                                                       |
| `oxlint`      | its oxlint config — a JS plugin and its rules, overrides                                                                  |
| `layers`      | its import boundaries, in the vocabulary of [the Architecture pass](06-quality-checks.md#the-architecture-layer-map-pass) |
| `names`       | its rules of where a name sits, in ls-lint's ([a name rule](06-quality-checks.md#a-name-rule-a-project-declares))         |
| `baseline`    | the sections of `jterrazz.baseline.json` it writes and judges                                                             |
| `floors`      | which of those sections hold a floor, which only rises, rather than a debt                                                |
| `presets`     | the presets it includes                                                                                                   |

`definePreset` types one. A repository declares the presets it is held to in `jterrazz.config.ts`, and adds only what is its own:

```ts
import { test } from '@jterrazz/test/config';
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({
    presets: [typescript({ profile: 'node' }), test()],
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});
```

Its `oxlint.config.ts` then composes what the presets carry, and names nothing else:

```ts
import { defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

export default defineConfig(fromPresets(settings));
```

A preset is declared, never discovered from `node_modules`: what a repository is held to is read in one file.

### The base preset

`typescript()` is always on, whether the repository names it or not; naming it chooses its `profile`, the oxlint profile `fromPresets` starts from (`node` where none is named). It carries the laws every repository of the family keeps:

- the direction of `lint/` — `engine-knows-no-declaration`, `consumer-folders-apart`, `self-folders-apart`, `catalogue-at-the-bottom`, `shipped-lint-reads-no-self`, `src-reads-no-declaration` — layers the Architecture pass holds a `lint/` tree to wherever one stands ([Architecture](01-architecture.md#the-judging-layer));
- the folders of the lint tree, the spine and the roots a tool imposes, and the three rosters of the Names pass ([Quality checks](06-quality-checks.md#the-names-tree-pass)).

A law whose `from` names no file of the project costs it nothing: the Architecture pass drops it before it cruises, so a repository without a `lint/` tree runs no cruise for the base preset's laws.

### The merge order

Resolution is deterministic, and the same in every reader:

1. The base preset first, then each listed preset in the order written; a preset's own presets come before it, depth first, and a preset named twice keeps its first place. Listing the base preset — `typescript({ profile: 'next' })`, at the top level or inside another preset — chooses only its settings, merged over the base's own in the order met: its laws, its baseline and its floors stay the base preset's, whatever the listed object carries. Two presets of one name from two packages are refused.
2. Each section is its presets' `settings` merged in that order, then the repository's own section over them: a list concatenates with duplicates dropped, a record merges key by key, and a single value the repository writes wins. A list or a record is never replaced by another shape — a `null` or a string written over the spine is refused — so a default is added to, never written away. A setting a preset names in its `lawSettings` is a law, not a default: no listing and no section adds to it — the base preset's are the lint tree, the spine, the member roots, the tool roots and the rosters of words — and a root the repository keeps beside the spine is declared under `typescript.roots` with its reason.
3. The laws — `layers` and `names` — are every preset's in that order, then the repository's own (`typescript.architecture.layers`, `typescript.names`).
4. `oxlint` is every preset's config, composed by `compose` in that order after the base profile.

A file that does not load, a `presets` that is not a list of presets, a section that is not an object, a setting that replaces a default's shape, a write to a law setting, or a `presets` written inside a section rather than at the top level is refused in four parts by the pass that reads it, reading this heading.

### Setting a law aside

A repository cannot drop a preset's law by writing over it: a law is a preset's, not a setting. It sets one aside in the open, under `optOuts`, naming the law as `<preset>/<rule>` and saying why:

```ts
export default defineConfig({
    optOuts: {
        'typescript/self-folders-apart': 'the corpus reads a check it audits, until it moves',
    },
    presets: [typescript()],
});
```

An opt-out with no reason, or one naming a law no preset declares, is refused like a file that does not load. Each one is counted: the drift report prints how many laws the repository set aside, and which ([Quality checks](06-quality-checks.md#the-drift-report)).

## Related

- [Architecture](01-architecture.md) — where the kit sits in `lint/`.
- [Quality checks](06-quality-checks.md) — the passes that read what a preset declares.
- [Developing](02-developing.md) — the settings file a repository keeps.
