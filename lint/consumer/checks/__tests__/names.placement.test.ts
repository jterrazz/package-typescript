import { describe, expect, test } from 'vitest';

import { placementFindingOf } from '../names.placement.js';

const TREE = {
    consumer: ['catalogue', 'rulebook', 'rules', 'checks'],
    kit: ['project'],
    self: ['catalogue', 'rules', 'checks', 'corpus'],
};

describe('placementFindingOf', () => {
    test('placementFindingOf — a folder of the self tree that is no declaration folder is told where a program and its parts go', () => {
        // Given - a folder at the root of lint/self/ that none of the four names
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/self/reading' },
        );

        // Then - it names the folder, and the fix lists the folders, then says what a program at the self root composes
        expect(finding?.message).toContain('found: `lint/self/reading/` is not a folder of self/');
        expect(finding?.message).toContain(
            'fix: move its files into the folder its nature names, catalogue/, rules/, checks/, corpus/; a program at the self root composes, and the parts it tests live in corpus/, tested there',
        );
    });

    test('placementFindingOf — the same finding under consumer/ adds nothing about a program', () => {
        // Given - a folder at the root of lint/consumer/ that is none of its four
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/consumer/reading' },
        );

        // Then - the fix ends on the folders
        expect(finding?.message).toContain(
            'fix: move its files into the folder its nature names, catalogue/, rulebook/, rules/, checks/ · read:',
        );
    });

    test('placementFindingOf — a file at the root of a tree folder is a file there, and what lies deeper is left to the rest of the pass', () => {
        // Given - a file at the root of lint/self/ and a folder under a known folder of it
        const file = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: false, path: 'lint/self/notes.ts' },
        );
        const deeper = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/self/rules/unsorted' },
        );
        const deeperFile = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: false, path: 'lint/self/rules/unsorted.ts' },
        );

        // Then - the file is told it holds a file at the root; the deeper folder is no finding of this check
        expect(file?.message).toContain(
            'found: `lint/self/notes.ts` holds a file at the root of self/',
        );
        expect([deeper, deeperFile]).toStrictEqual([undefined, undefined]);
    });

    test('placementFindingOf — a tree folder that itself fails is moved as a file, not as a folder of files', () => {
        // Given - the folder lint/kit/ named alone
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/kit' },
        );

        // Then - the fix speaks of the file
        expect(finding?.message).toContain('fix: move the file into the folder');
    });

    test.each([
        [
            'lint/self/reading',
            true,
            {
                message:
                    'found: `lint/self/reading/` is not a folder of self/ · why: self/ holds the declarations only this repository is held to: its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the modules that compose them with kit/ · fix: move its files into the folder its nature names, catalogue/, rules/, checks/, corpus/; a program at the self root composes, and the parts it tests live in corpus/, tested there · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/self/reading/',
                rule: 'names/self-folder-is-known',
            },
        ],
        [
            'lint/consumer/reading',
            true,
            {
                message:
                    'found: `lint/consumer/reading/` is not a folder of consumer/ · why: consumer/ holds the declarations every consumer is held to: the catalogue, the rulebook of upstream decisions, our own rules by family, the checks, so its folders are catalogue, rulebook, rules, checks · fix: move its files into the folder its nature names, catalogue/, rulebook/, rules/, checks/ · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/consumer/reading/',
                rule: 'names/consumer-folder-is-known',
            },
        ],
        [
            'lint/self/notes.ts',
            false,
            {
                message:
                    'found: `lint/self/notes.ts` holds a file at the root of self/ · why: self/ holds the declarations only this repository is held to: its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the modules that compose them with kit/ · fix: move its files into the folder its nature names, catalogue/, rules/, checks/, corpus/; a program at the self root composes, and the parts it tests live in corpus/, tested there · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/self/notes.ts',
                rule: 'names/self-folder-is-known',
            },
        ],
        [
            'lint/kit',
            true,
            {
                message:
                    'found: `lint/kit/` holds a file at the root of kit/ · why: kit/ holds what runs the declarations and knows none of them: how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling, so its folders are project · fix: move the file into the folder its nature names, project/ · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/kit/',
                rule: 'names/kit-folder-is-known',
            },
        ],
        [
            'lint/notes.ts',
            false,
            {
                message:
                    'found: `lint/notes.ts` sits at the root of lint/, and is no entry · why: lint/ has one tree in every repository: its root holds the entries alone, each `index[.<name>].ts` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file · fix: move it into the folder its audience names (consumer, kit, self), name it `index.<name>.ts` and declare it if it is an entry, or move it into docs/ if it explains · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/notes.ts',
                rule: 'names/lint-root-holds-only-entries',
            },
        ],
        [
            'lint/helpers',
            true,
            {
                message:
                    'found: `lint/helpers/` is not a folder of the lint tree · why: lint/ has one tree in every repository, split by audience: consumer, kit, self · fix: move its files where their audience puts them: a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under kit/ · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'lint/helpers/',
                rule: 'names/lint-folder-is-known',
            },
        ],
        ['lint/__tests__/a.test.ts', false, undefined],
        ['skills/x/SKILL.md', false, undefined],
        ['skills/x/references/a.md', false, undefined],
        ['skills/ab/SKILL.md', false, undefined],
        ['skills/ab/references/ab.md', false, undefined],
        ['skills/x/references', true, undefined],
        [
            'skills/x/notes.md',
            false,
            {
                message:
                    "found: `skills/x/notes.md` sits beside a skill's `SKILL.md` · why: a skill is one `skills/<skill>/SKILL.md`, the page an agent loads, and the `references/*.md` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads · fix: fold what it says into the `SKILL.md`, move a long part under `references/<topic>.md` and link it, or delete it · read: docs/reference/quality-checks.md#the-names-tree-pass",
                path: 'skills/x/notes.md',
                rule: 'names/skill-holds-only-skill-md',
            },
        ],
        [
            'skills/x/extra',
            true,
            {
                message:
                    "found: `skills/x/extra/` sits beside a skill's `SKILL.md` · why: a skill is one `skills/<skill>/SKILL.md`, the page an agent loads, and the `references/*.md` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads · fix: fold what it says into the `SKILL.md`, move a long part under `references/<topic>.md` and link it, or delete it · read: docs/reference/quality-checks.md#the-names-tree-pass",
                path: 'skills/x/extra/',
                rule: 'names/skill-holds-only-skill-md',
            },
        ],
        [
            'skills/x/references/deep/a.md',
            false,
            {
                message:
                    "found: `skills/x/references/deep/a.md` sits beside a skill's `SKILL.md` · why: a skill is one `skills/<skill>/SKILL.md`, the page an agent loads, and the `references/*.md` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads · fix: fold what it says into the `SKILL.md`, move a long part under `references/<topic>.md` and link it, or delete it · read: docs/reference/quality-checks.md#the-names-tree-pass",
                path: 'skills/x/references/deep/a.md',
                rule: 'names/skill-holds-only-skill-md',
            },
        ],
        [
            'src/MyFolder',
            true,
            {
                message:
                    "found: `src/MyFolder/` is not written in kebab-case · why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not · fix: rename it in lowercase words joined by `-`; a `__<word>__` name is a special folder of the toolchain's closed list, and a route segment keeps its framework grammar (`[id]`, `(group)`, `@slot`) · read: docs/reference/quality-checks.md#the-names-tree-pass",
                path: 'src/MyFolder/',
                rule: 'names/directory-in-kebab-case',
            },
        ],
        [
            'src/__fixtures__',
            true,
            {
                message:
                    'found: `src/__fixtures__/` is the ground of a test outside every `__tests__/` · why: a `__<word>__/` folder is one the toolchain gives a meaning to: in a code root the special folders are `__tests__/`, and every other folder is named for what it holds · fix: move it into the `__tests__/` of its folder, beside the module tests that read it · read: docs/reference/quality-checks.md#the-names-tree-pass',
                path: 'src/__fixtures__/',
                rule: 'names/directory-in-kebab-case',
            },
        ],
        [
            'specs/__helpers__',
            true,
            {
                message:
                    'found: `specs/__helpers__/` is spelt like a special folder, and `__helpers__/` is none · why: a `__<word>__/` folder is one the toolchain gives a meaning to: under specs/ the special folders are `__setup__/`, `__expected__/`, `__fixtures__/`, `__requests__/`, `__seeds__/`, and every other folder is named for what it holds · fix: move what it holds into one of `__setup__/`, `__expected__/`, `__fixtures__/`, `__requests__/`, `__seeds__/`, or rename it in kebab-case for what it holds · read: docs/reference/quality-checks.md#the-names-tree-pass',
                path: 'specs/__helpers__/',
                rule: 'names/directory-in-kebab-case',
            },
        ],
        [
            'src/__helpers__',
            true,
            {
                message:
                    'found: `src/__helpers__/` is spelt like a special folder, and `__helpers__/` is none · why: a `__<word>__/` folder is one the toolchain gives a meaning to: in a code root the special folders are `__tests__/`, and every other folder is named for what it holds · fix: move what it holds into one of `__tests__/`, or rename it in kebab-case for what it holds · read: docs/reference/quality-checks.md#the-names-tree-pass',
                path: 'src/__helpers__/',
                rule: 'names/directory-in-kebab-case',
            },
        ],
        ['src/File.ts', false, undefined],
        [
            'packages/a/lint/self/reading',
            true,
            {
                message:
                    'found: `packages/a/lint/self/reading/` is not a folder of self/ · why: self/ holds the declarations only this repository is held to: its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the modules that compose them with kit/ · fix: move its files into the folder its nature names, catalogue/, rules/, checks/, corpus/; a program at the self root composes, and the parts it tests live in corpus/, tested there · read: docs/reference/quality-checks.md#the-lint-tree',
                path: 'packages/a/lint/self/reading/',
                rule: 'names/self-folder-is-known',
            },
        ],
    ])(
        'placementFindingOf — %s (a folder: %s) is judged whole, its lesson to the letter',
        (path, isDirectory, finding) => {
            // Given - the lint tree of the root and of a member, and the path the layout refused
            const trees = { '': TREE, 'packages/a/': TREE };

            // Then - the finding the pass prints for it, or none
            expect(
                placementFindingOf({ trees, units: ['packages/a/'] }, { isDirectory, path }),
            ).toStrictEqual(finding);
        },
    );
});
