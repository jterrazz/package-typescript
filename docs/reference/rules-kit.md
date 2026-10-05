# Rules kit

For a package of the family that holds its consumers to rules of its own. `@jterrazz/typescript/rules` exports the kit this toolchain judges itself with, so a sibling package writes a rule, its message, its chapter and its debt the way this package does, and the family keeps one copy of each. The rules reach a project through the package's preset ([Configuration § Presets](configuration.md#presets)). This page follows a rule from its catalogue row to its message, its check, its chapter, its debt and what it reads.

The kit is `lint/kit/`, exported through `lint/index.rules.ts` ([Architecture](../concepts/architecture.md#the-judging-layer)). Under the `browser` condition it is `lint/index.rules.browser.ts`, the half that reads no disk: the lesson, the rule, the table and the ground folders. Nothing in the kit knows a declaration, so a sibling package keeps in its own kit only what no other package reads; `@jterrazz/test` keeps its spec-document model, its specifications and its stub kinds.

## A rule is a catalogue row

A rule starts as a row, a `RuleDocs`: its `name`, its `family`, its `audience` (an `Audience` — `consumer` ships, `self` is the package's own discipline), the `sentence` it holds a project to, and the `fix` a reader applies. `rowNamed(rows, name)` finds one and refuses a name no row holds; `byName(rows)` orders a catalogue so a generated chapter is the same from one run to the next.

Every message a rule prints teaches in four parts — `found: … · why: … · fix: … · read: …` — and the kit writes it: the finding states what was found and the fix for this case, the row gives the why (its `why`, or the first sentence of its `sentence`), and the read is the chapter anchor. A `Lesson` is the four parts, an `Unread` the three a judge returns before its caller names the chapter, and a `Teaching` the `found` and `fix` of one case; `Taught` is what a row lends the rest, its `sentence` and its `why`. `refusal(lesson)` writes one line, `refusalBlock(lesson)` one part per line; `lessonOf(row, read, teaching)` writes one case's message, its why `whyOf(row)` — the row's `why`, or `firstSentence(sentence)`. `lessonParts` and `missingParts` read a message back, in the order `LESSON_PARTS` holds, which is how a meta-test refuses a message missing a part. A read is a `ChapterAnchor`, `docs/<chapter>.md#<anchor>`, and `readAt(row, chapter)` writes a row's, a `Chapter` being `docs/<name>.md`.

`defineRule(definition, body)` writes an oxlint JS rule from its row — a `RuleDefinition`: its `docs`, its `messages`, its `read`, a `RuleType` and the `RuleOptions` oxlint reads (`schema`, `defaultOptions`, `fixable`) — and a `RuleBody`, the visitor factory oxlint takes, `create` or `createOnce`:

```ts
import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { RuleDocs } from '@jterrazz/typescript/rules';

type Visitor = { report: (problem: { messageId: string; node: unknown }) => void };

const ROWS: RuleDocs[] = [
    {
        audience: 'consumer',
        family: 'timing',
        fix: 'await the event the test waits for',
        name: 'no-sleep',
        sentence: 'A test waits on an event, never on the clock.',
    },
];

const row = rowNamed(ROWS, 'no-sleep');

export const noSleep = defineRule(
    {
        docs: row,
        messages: {
            slept: { found: '`sleep()` waits on the clock', fix: 'await the event itself' },
        },
        read: readAt(row, 'docs/24-linting.md'),
    },
    {
        createOnce: (context: Visitor) => ({
            'CallExpression[callee.name="sleep"]': (node: unknown) =>
                context.report({ messageId: 'slept', node }),
        }),
    },
);
```

The result is a `DefinedRule`: the body, and a `RuleMeta` whose `docs` is the row and each message its lesson, a `{{data}}` placeholder left for oxlint to fill. `lessonsAt(row, messages, chapter)` is the same composition for a rule that states its `meta` itself, its read the row's anchor in the chapter.

A refusal a package's own code throws is the same four parts. `defineInvariant({ package, bugOf, notOf })` — an `InvariantOwner` — gives a package its `invariant()`, the error only the package itself can cause, whose message says so.

## A cross-file check

What one file cannot show — the tree, the manifest, the manual — is a check. `defineCheck({ docs, namespace, read })` — a `CheckDefinition` — binds a row to its printed id, `<namespace>/<name>`, and the `DefinedCheck`'s `.finding(at, teaching)` returns the finding at its position — a `Located`: a `path`, a `line`, a `column` — with its four-part message. Every check of the family returns that one `Finding`, and `reportLine(finding)` prints it in the compiler's convention, `path:line:column: error <namespace>(<name>): message`, the one every editor's problem matcher reads.

`runChecker({ passes, held, commands })` — a `Checker`: its `Passes`, each a `Pass` whose `check(context)` returns a `PassResult`, the `Held` sections and the `Commands` — is the command line of a set of passes, `checker <pass> [root]`: it reads the arguments (`--fix`, `--format`, a flag's value written apart or as `--flag=value`), hands a pass its `Context` — the project root, its sweep, its settings resolved with the base preset first — prints each finding through `reportLine`, applies its fixes, and judges a pass `held` names against its section of the baseline, printing the section it stands on when it holds (`.jterrazz/baseline.json › test: 3 held across 2 rules`). `--format json` prints the findings as JSON instead, each with its `rule`, `path`, `line`, `column` and `message`. A pass counts its findings under its own name, or under the `namespace` it states; a result it marks `deferred` is reported and judged by another run, so it fails only on what stopped it. `commands` are the verbs beside the passes — a recording gesture, a query — each a `KitCommand`. `readCommandLine(args, valued)` is the reading `runChecker` does, a `CommandLine`, for a command that parses its own. A program that unwinds instead of exiting throws `stop(code)` and reads the code back with `exitCodeOf(program)`.

A preset hands its passes to the toolchain rather than shipping a program: a `Contribution` — a `Checker` without its `presets` — is the default export of the module its `checker` names, and `typescript check`, `fix` and `baseline` run it through this package's own checker program, every pass on `check` and `fix`, a command by its name ([A preset's checks](quality-checks.md#a-presets-checks)).

`presetChecks(root, config)` — a `PresetChecks` — runs the laws resolved settings hold a tree to — the Architecture pass over every preset's `layers` and the repository's own, and each declared `names` rule — with `config` written as a `jterrazz.config.ts` would be, `{ presets, optOuts, typescript: { … } }`, the base preset first: `{}` holds a tree to the base preset alone. It returns their findings, each at its position, and any problem that stopped a pass — a settings object that cannot be resolved included.

### Testing a rule

`@jterrazz/test` is the kit to test what this one writes ([Lint specs](https://github.com/jterrazz/package-test/blob/main/docs/guides/lint-specs.md)): `ruleTester()` runs a rule's visitor on snippets, and refuses an invalid case that states no `line` and `column`; `specification.lint()` lints a fixture tree with the real oxlint, a checker's command or the laws of presets, and compares the whole report. A rule is proven where its behaviour lives — its visitor on a snippet, what it says about a tree on a tree.

A rule's module test is one table of every case the rule decides, so its length counts them: the rulebook leaves `max-lines` off for `lint/consumer/rules/**/*.test.ts`, in every repository that ships rules.

## A chapter carries its catalogue

A chapter that lists rules carries them between markers and never by hand. A `Projection` is a page, its `Markers` and the `render` that writes the block; `projected(text, page, projections)` splices every block of a page, `writeProjections(projections)` writes only a page whose text changed, and `spliceBetween` refuses a page that lost its markers. `markdownTable` pads a table as the formatter does, so a generated block is format-clean; `cell` escapes a pipe, `anchor(name)` gives a row the anchor its lesson reads, and `anchorsOf(text)` lists every heading and row anchor a page holds.

## The ratchet engine

Debt no linter holds lives in `.jterrazz/baseline.json` — `BASELINE` names it — one section per preset ([Quality checks](quality-checks.md#what-jterrazzbaselinejson-still-holds)). The kit reads it and writes it: `readBaseline` refuses a file that is not an object of sections of counts (a `ReadBaseline`, its `Sections` each a `Counts`), `sectionOf` reads one, `keepsSection` says whether the file holds one, `labelOf(section)` prints it as `.jterrazz/baseline.json › <section>`, and `writeSection` writes one and keeps every other byte of the file, in the indent the file already uses. `countsOf(findings)` counts findings by rule, the shape a section holds. oxlint's own debt stays in the tool's native format: `SUPPRESSIONS_LEDGER` names where it is tracked, `.jterrazz/oxlint-suppressions.json`, and `OXLINT_SUPPRESSIONS` the root name oxlint reads it under, where the command stages it for the length of a run — oxlint takes no path for it.

One judge reads it. `judgeExact(counts, recorded, { record, lower })` holds debt exactly: a count above its entry, a rule with findings and no entry, a count below its entry and an entry at zero each break it. `tightened` is what `fix` writes — it lowers what fell and drops what reached zero, and never raises an entry nor adds one, so debt that grew is recorded only by the recording gesture. A judge returns what broke as a `Broken` — the rule and a lesson with no read; the caller writes the chapter it reads in place. A `Ratchet` names the two gestures a judge's lesson points to, `record` and `lower`, and a `HeldSection` is a section a checker judges, with them and its read.

## Reading a project

The readers every check needs are the kit's, so two packages never read one project two ways:

- the sweep: `projectFiles`, the files git does not ignore, `filesUnder(dir)`, the same below one folder, and `ignoredPaths(root, paths)`, which of many paths git ignores, in one call; `PRUNED`, the folders no walk enters; `treeEntries` (each a `TreeEntry`), `treeKind` and `treeNames`, a directory listed as git sees it, cached until the index or the directory changes — `forgetTree` drops that cache, and `folderChanged(folder)` says whether a folder's listing changed since it was last asked;
- the disk as git sees it: `isFile`, `isDirectory`, `listDirectory` and `readFileCached`, and `isOnDisk` for `.git`, which git never lists; `moveKeepingHistory(from, to)` moves a path with `git mv` where it can;
- the source text: `blankComments(text)` turns every comment to spaces and `quotedMask(text)` marks every offset inside a string or a template's text, both from the one lexer the Suppressions pass reads, each `Span` a start and an end on a line — so every offset, line and column still holds;
- the workspace: `workspaceMembers`, found no deeper than `MEMBER_DEPTH`, `readManifest` (a `Manifest`), `workspacePatterns`; the roots: `nearestRoot(from, isRoot)` walks up to the nearest folder `isRoot` holds, `holdsManifest` is a folder with a `package.json`, `isRepositoryRoot` one with a `.git`, and `isProjectRoot` either;
- what a package publishes: `entryPoints`, each output its `exports`, `main` and `bin` publish under `dist/` mapped to the entry it is built from ([Building](building.md#the-entries)), and `declaredSubpaths`, the subpaths it declares;
- the tools' own files: `OXLINT_CONFIG_NAMES`, the names oxlint looks for a project's config under, in its order;
- the ground a spec stands on: `GROUND_FOLDERS` — `GROUND_FIXTURES`, `GROUND_EXPECTED`, `GROUND_SEEDS`, `GROUND_REQUESTS`, matched wherever it sits by the glob `GROUND_GLOB`, and a name by `isGroundFolder` — and `RESERVED_FOLDERS`, with `SETUP_FOLDER` and `SHARED_FOLDER`, read by `isReservedFolder`; `UNMARKED_RESERVED` maps each name written without its `_` to the folder it means — one list, which the oxlint and oxfmt presets ignore and every check skips;
- a suppression: `suppressionDirectives(stem)` reads `<stem>-disable-next-line <id> -- reason` and `<stem>-disable-line` (its `SuppressionDirectives`, each a `Directive`), and `holdsDirectives(path)` says which files may carry one;
- the settings: `readSettings(unit)` and `readSettingsSync(unit)`, a unit's `jterrazz.config.ts` resolved through its presets — a `Resolution`: the `problem` that stopped it, if any, and the `Resolved` presets, sections, laws (each a `PresetLaw`, `<preset>/<rule>`), opt-outs and baseline sections.

`@jterrazz/typescript/rules` exports this and nothing more: what the kit keeps beside it — its caches, its merge of settings, its resolver — is its own, so a sibling resolves settings only through the readers above, the base preset always first. The preset's own vocabulary — `definePreset`, `Preset`, `ArchitectureRule`, `NamesRule`, `OptOut` — is `@jterrazz/typescript/config`'s.

## Related

- [Architecture](../concepts/architecture.md) — where the kit sits in `lint/`.
- [Quality checks](quality-checks.md) — the passes that read what a preset declares.
- [Configuration](configuration.md) — the settings file and the presets a project lists.
