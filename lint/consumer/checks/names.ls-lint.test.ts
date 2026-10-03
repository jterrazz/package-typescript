import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { LINT_TREE } from '../catalogue/preset.js';
import { ignoredOf, lsLintConfig, lsLintFindings, runLsLint } from './names.ls-lint.js';

const LS_LINT = join(import.meta.dirname, '../../../node_modules/.bin/ls-lint');

const scratchFolders = (): string[] =>
    readdirSync(tmpdir()).filter((name) => name.startsWith('typescript-ls-lint-'));

function findingsOf(
    swept: readonly string[],
    {
        failures = {},
        units = [''],
    }: { failures?: Parameters<typeof lsLintFindings>[1]['failures']; units?: string[] } = {},
): string[] {
    return lsLintFindings(tmpdir(), { failures, swept, tree: LINT_TREE, units }).map(
        ({ path, rule }) => `${rule}  ${path}`,
    );
}

function onDisk(paths: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'names-ls-lint-'));
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), 'export {};\n');
    }

    return root;
}

describe('names.ls-lint', () => {
    test('names only what the sweep holds, a refused file, a refused directory and one listed whole', () => {
        // Given - ls-lint refusing an ignored scratch file, a directory holding only ignored files, and consumer/ listed whole beside Finder's file
        const root = onDisk([
            'lint/consumer/.DS_Store',
            'lint/consumer/listing.ts',
            'lint/scratch.ts',
            'src/Api_Client/client.ts',
        ]);
        const failures = {
            'lint/consumer': { '.*': ['exists:0'] },
            'lint/scratch.ts': { '.*': ['regex:index'] },
            'src/Api_Client': { '.dir': ['regex:kebab'] },
        };

        // When - the failures are read against a sweep holding lint/consumer/listing.ts alone
        const findings = lsLintFindings(root, {
            failures,
            swept: ['lint/consumer/listing.ts'],
            tree: LINT_TREE,
            units: [''],
        });
        rmSync(root, { force: true, recursive: true });

        // Then - the file git sees is the one finding
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/consumer-folder-is-known  lint/consumer/listing.ts',
        ]);
    });

    test('judges a file ls-lint never looks at wherever a folder is closed', () => {
        // Given - files with no extension and a dot-file in closed folders, and one in an open folder
        const swept = [
            'lint/NOTES',
            'lint/consumer/.notes',
            'lint/consumer/README',
            'lint/consumer/checks/README',
            'skills/a/LICENSE',
            'skills/a/SKILL.md',
        ];

        // When - ls-lint reported nothing
        const findings = lsLintFindings(tmpdir(), {
            failures: {},
            swept,
            tree: LINT_TREE,
            units: [''],
        });

        // Then - each file in a closed folder is refused under the rule of its place
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/lint-root-holds-only-entries  lint/NOTES',
            'names/consumer-folder-is-known  lint/consumer/.notes',
            'names/consumer-folder-is-known  lint/consumer/README',
            'names/skill-holds-only-skill-md  skills/a/LICENSE',
        ]);
    });

    test('names a refused file the sweep holds, and a refused folder by itself alone', () => {
        // Given - a refused entry file, and a refused skill folder holding a file ls-lint never looks at
        const failures = {
            'skills/Bad': { '.dir': ['regex:kebab'] },
            'lint/scratch.ts': { '.*': ['regex:index'] },
        };

        // Then - each is named once, the file inside the folder through its folder
        expect(findingsOf(['skills/Bad/NOTES', 'lint/scratch.ts'], { failures })).toStrictEqual([
            'names/lint-root-holds-only-entries  lint/scratch.ts',
            'names/skill-holds-only-skill-md  skills/Bad/',
        ]);
    });

    test('judges a file in a closed folder of a workspace member by its own place, and leaves what ls-lint sees to ls-lint', () => {
        // Given - a member's unseen file, an entry and a skill page ls-lint judges, and an unseen file in an open folder
        const swept = [
            'packages/a/lint/NOTES',
            'lint/NOTES',
            'lint/index.ts',
            'skills/a/SKILL.md',
            'src/README',
        ];

        // Then - the member's file is judged under the member's lint/
        expect(findingsOf(swept, { units: ['', 'packages/a/'] })).toStrictEqual([
            'names/lint-root-holds-only-entries  lint/NOTES',
            'names/lint-root-holds-only-entries  packages/a/lint/NOTES',
        ]);
    });

    test('ignores what ls-lint never enters, and each pattern a project ignores as its folder', () => {
        // Given - two patterns, one a folder's whole content
        const ignored = ignoredOf(['vendor/**', 'tmp', 'docs/**/*.draft.md']);

        // Then - the toolchain's ignores lead, the project's follow
        expect([ignored.includes('node_modules'), ignored.slice(-3)]).toStrictEqual([
            true,
            ['vendor', 'tmp', 'docs/**/*.draft.md'],
        ]);
    });

    test('runs ls-lint over a tree, reading its failures, and leaves no scratch folder', () => {
        // Given - a tree with one refused folder, and one with none
        const config = lsLintConfig({ ignorePatterns: [], tree: LINT_TREE, units: [''] });
        const refused = onDisk(['src/Api_Client/client.ts']);
        const clean = onDisk(['src/api-client/client.ts']);
        const before = scratchFolders();

        // When - ls-lint runs over each
        const runs = [runLsLint(LS_LINT, refused, config), runLsLint(LS_LINT, clean, config)];

        // Then - the refused folder is named, the clean tree has nothing, and the scratch folders are gone
        expect(runs).toStrictEqual([
            {
                failures: { 'src/Api_Client': { '.dir': [expect.stringMatching(/^regex:/u)] } },
                problem: null,
            },
            { failures: {}, problem: null },
        ]);
        expect(scratchFolders()).toStrictEqual(before);
    });

    test('refuses through ls-lint every place the lint tree, the skills and the named roots close', () => {
        // Given - one tree breaking each rule, in the root and in a workspace member, beside what each rule allows
        const config = lsLintConfig({
            ignorePatterns: ['vendor/**'],
            tree: LINT_TREE,
            units: ['', 'packages/m/'],
        });
        const root = onDisk([
            'lint/index.ts',
            'lint/stray.ts',
            'lint/consumer/loose.ts',
            'lint/consumer/checks/fine.ts',
            'lint/consumer/checks/Bad_Dir/x.ts',
            'lint/kit/loose.ts',
            'lint/self/Bad_Name.ts',
            'lint/self/notes.md',
            'skills/loose.md',
            'skills/a/SKILL.md',
            'skills/a/other.md',
            'skills/a/sub/x.md',
            'skills/Bad_Skill/SKILL.md',
            'src/app/[id]/page.tsx',
            'src/app/Any_Segment/page.tsx',
            'src/Bad_Dir/x.ts',
            'vendor/Bad_Dir/x.ts',
            'packages/m/lint/stray.ts',
            'packages/m/src/Bad_Dir/x.ts',
        ]);

        // When - ls-lint runs over it
        const { failures } = runLsLint(LS_LINT, root, config);

        // Then - each broken rule names its path, and nothing allowed is named
        expect(Object.keys(failures).toSorted()).toStrictEqual([
            'lint/consumer',
            'lint/consumer/checks/Bad_Dir',
            'lint/kit',
            'lint/self/Bad_Name.ts',
            'lint/self/notes.md',
            'lint/stray.ts',
            'packages/m/lint/stray.ts',
            'packages/m/src/Bad_Dir',
            'skills',
            'skills/Bad_Skill',
            'skills/a/other.md',
            'skills/a/sub',
            'src/Bad_Dir',
        ]);
    });

    test('names a run that leaves no report, and a binary that is not there', () => {
        // Given - a config ls-lint cannot read
        const root = onDisk(['src/a.ts']);

        // When - it runs with it, then a binary nowhere on disk runs
        const unread = runLsLint(LS_LINT, root, 'ls: [not a map\n');
        const missing = runLsLint(join(root, 'no-ls-lint'), root, '');

        // Then - each problem says what stopped the pass, ls-lint's own words set apart
        const said = /(?<=— ).*?(?= · why)/u;
        expect(
            [unread, missing].map(({ failures, problem }) => [
                failures,
                problem?.replace(said, '…'),
            ]),
        ).toStrictEqual([
            [
                {},
                'found: ls-lint stopped with no report — … · why: where a name sits is judged from the failures ls-lint reports, and with no report no name is judged · fix: correct what ls-lint printed — an `--ignore-pattern` or a declared glob it cannot read, a directory it cannot enter — then run again · read: docs/07-quality-checks.md#the-names-tree-pass',
            ],
            [
                {},
                "found: ls-lint could not be run — … · why: the pass hands the tree to ls-lint, and a tool that never ran judged nothing · fix: run 'npm install' so the ls-lint @jterrazz/typescript pins is installed beside it, then run again · read: docs/07-quality-checks.md#the-passes",
            ],
        ]);
        expect([
            unread.problem?.includes('yaml: line 1:'),
            missing.problem?.endsWith('#the-passes'),
        ]).toStrictEqual([true, true]);
    });
});
