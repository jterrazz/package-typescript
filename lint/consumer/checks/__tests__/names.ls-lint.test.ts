import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { objectOf, parsedObject } from '../../../kit/project/json.js';
import { ignoredOf, lsLintConfig, lsLintFindings, runLsLint } from '../names.ls-lint.js';
import { LS_LINT, onDisk, treesOf } from './names.ls-lint.fixtures.js';

function findingsOf(
    swept: readonly string[],
    {
        failures = {},
        units = [''],
    }: { failures?: Parameters<typeof lsLintFindings>[1]['failures']; units?: string[] } = {},
): string[] {
    return lsLintFindings(tmpdir(), { failures, swept, trees: treesOf(units), units }).map(
        ({ path, rule }) => `${rule}  ${path}`,
    );
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
            trees: treesOf(['']),
            units: [''],
        });
        rmSync(root, { force: true, recursive: true });

        // Then - the file git sees is the one finding
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/consumer-folder-is-known  lint/consumer/listing.ts',
        ]);
    });

    test('judges a file ls-lint never looks at wherever a folder is closed', () => {
        // Given - files with no extension and a dot-file in closed folders, and ones in open folders: deeper than a closed place, or under a folder of the same name below another root
        const swept = [
            'lint/NOTES',
            'lint/consumer/.notes',
            'lint/consumer/README',
            'lint/consumer/checks/README',
            'skills/a/LICENSE',
            'skills/a/SKILL.md',
            'skills/ab/LICENSE',
            'skills/ab/references/NOTES',
            'skills/NOTES',
            'docs/lint/NOTES',
            'docs/lint/consumer/NOTES',
            'docs/skills/NOTES',
            'docs/skills/ab/NOTES',
        ];

        // When - ls-lint reported nothing
        const findings = lsLintFindings(tmpdir(), {
            failures: {},
            swept,
            trees: treesOf(['']),
            units: [''],
        });

        // Then - each file in a closed folder is refused under the rule of its place, the others left
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/lint-root-holds-only-entries  lint/NOTES',
            'names/consumer-folder-is-known  lint/consumer/.notes',
            'names/consumer-folder-is-known  lint/consumer/README',
            'names/skill-holds-only-skill-md  skills/NOTES',
            'names/skill-holds-only-skill-md  skills/a/LICENSE',
            'names/skill-holds-only-skill-md  skills/ab/LICENSE',
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

    test('admits the references of a skill, and refuses a folder or a file of another kind inside them', () => {
        // Given - the failures ls-lint reports for a skill's references: a folder, a text file, and (kept clean) a page and the folder itself
        const failures = {
            'skills/shop/references/drafts': { '.dir': ['exists:0'] },
            'skills/shop/references/notes.txt': { '.*': ['exists:0'] },
        };
        const swept = [
            'skills/shop/SKILL.md',
            'skills/shop/references/drafts/outline.md',
            'skills/shop/references/notes.txt',
            'skills/shop/references/rules.md',
        ];

        // Then - the folder and the text file are refused where they stand, the page and `references/` itself are not named
        expect(findingsOf(swept, { failures })).toStrictEqual([
            'names/skill-holds-only-skill-md  skills/shop/references/drafts/',
            'names/skill-holds-only-skill-md  skills/shop/references/notes.txt',
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

    test('holds to no lint tree a member whose kind keeps none, and lays out no rule of it for ls-lint', () => {
        // Given - the root keeping the lint tree, a member keeping none, each with a file at the root of its lint/
        const trees = treesOf(['']);
        const swept = ['lint/NOTES', 'packages/a/lint/NOTES'];

        // When - the findings are read, and the config written
        const findings = lsLintFindings(tmpdir(), {
            failures: {},
            swept,
            trees,
            units: ['', 'packages/a/'],
        });
        const config = lsLintConfig({ ignorePatterns: [], trees, units: ['', 'packages/a/'] });

        // Then - only the root's lint/ is judged, and laid out
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/lint-root-holds-only-entries  lint/NOTES',
        ]);
        const places = Object.keys(objectOf(parsedObject(config).ls));
        expect(places.filter((place) => place.includes('lint'))).toStrictEqual([
            'lint',
            'lint/consumer',
            'lint/consumer/{catalogue,rulebook,rules,checks}',
            'lint/kit',
            'lint/kit/{project,baseline,checker,catalogue,compiler,testing}',
            'lint/self',
            'lint/self/{catalogue,rules,checks,corpus}',
            'lint/__tests__',
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
        const config = lsLintConfig({ ignorePatterns: [], trees: treesOf(['']), units: [''] });
        const refused = ['src/Api_Client/client.ts'];
        const clean = ['src/api-client/client.ts'];
        const scratch = mkdtempSync(join(tmpdir(), 'names-ls-lint-scratch-'));
        vi.stubEnv('TMPDIR', scratch);

        // When - ls-lint runs over each
        const runs = [runLsLint(LS_LINT, config, refused), runLsLint(LS_LINT, config, clean)];
        vi.unstubAllEnvs();

        // Then - the refused folder is named, the clean tree has nothing, and the scratch folders are gone
        expect(runs).toStrictEqual([
            {
                failures: { 'src/Api_Client': { '.dir': [expect.stringMatching(/^regex:/u)] } },
                problem: null,
            },
            { failures: {}, problem: null },
        ]);
        expect(readdirSync(scratch)).toStrictEqual([]);
    });

    test('allows the special folders of each root, and no other spelt alike', () => {
        // Given - the specs root's __setup__ beside an unknown special folder, a stray __setup__ and stray ground in a code root, a folder off kebab-case under tests/, folders off kebab-case under specs/, the lint tree's tests and the ground of a spec or a module test, and one in a folder no rule names
        const config = lsLintConfig({ ignorePatterns: [], trees: treesOf(['']), units: [''] });
        const paths = [
            'docs/Notes_Dir/a.md',
            'lint/__tests__/Bad_Dir/a.ts',
            'specs/Bad_Dir/a.ts',
            'specs/__mocks__/a.ts',
            'specs/__setup__/a.ts',
            'specs/api/__fixtures__/Odd_Name/a.json',
            'src/__fixtures__/a.json',
            'src/__setup__/a.ts',
            'src/__tests__/a.test.ts',
            'src/x/__tests__/__fixtures__/Odd_Name/a.json',
            'tests/Bad_Dir/a.ts',
        ];

        // When - ls-lint runs over it
        const { failures } = runLsLint(LS_LINT, config, paths);

        // Then - the folders off their root's list, and nothing the lists hold or no rule names
        expect(Object.keys(failures).toSorted()).toStrictEqual([
            'lint/__tests__/Bad_Dir',
            'specs/Bad_Dir',
            'specs/__mocks__',
            'src/__fixtures__',
            'src/__setup__',
            'tests/Bad_Dir',
        ]);
    });

    test("refuses through ls-lint every place the lint tree, the skills and the named roots close, and leaves a member's tool roots to their tool", () => {
        // Given - one tree breaking each rule, in the root and in a workspace member, beside what each rule allows (the member's Prisma migrations, timestamped by Prisma, among it, and its bin/, a code root as well as a tool root)
        const config = lsLintConfig({
            ignorePatterns: ['vendor/**'],
            toolRoots: { 'packages/m/': ['bin', 'prisma'] },
            trees: treesOf(['', 'packages/m/']),
            units: ['', 'packages/m/'],
        });
        const paths = [
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
            'packages/m/bin/Bad_Dir/x.ts',
            'packages/m/prisma/migrations/20260902230946_init/migration.sql',
        ];

        // When - ls-lint runs over it
        const { failures } = runLsLint(LS_LINT, config, paths);

        // Then - each broken rule names its path, and nothing allowed is named
        expect(Object.keys(failures).toSorted()).toStrictEqual([
            'lint/consumer',
            'lint/consumer/checks/Bad_Dir',
            'lint/kit',
            'lint/self/Bad_Name.ts',
            'lint/self/notes.md',
            'lint/stray.ts',
            'packages/m/bin/Bad_Dir',
            'packages/m/lint/stray.ts',
            'packages/m/src/Bad_Dir',
            'skills',
            'skills/Bad_Skill',
            'skills/a/other.md',
            'skills/a/sub',
            'src/Bad_Dir',
        ]);
    });

    test('hands ls-lint a tree laid out from the paths alone, whatever the disk holds', () => {
        // Given - a binary that reports every file of the tree it is run in with its size, and the paths of a sweep, one under a dot folder and one a manifest
        const scratch = mkdtempSync(join(tmpdir(), 'names-ls-lint-binary-'));
        onTestFinished(() => {
            rmSync(scratch, { force: true, recursive: true });
        });
        const binary = join(scratch, 'ls-lint');
        writeFileSync(
            binary,
            '#!/bin/sh\nprintf \'{"tree":{"files":["%s"]}}\' "$(find . -type f | sort | while read -r file; do printf \'%s:%s \' "$file" "$(wc -c < "$file" | tr -d \' \')"; done)"\nexit 1\n',
        );
        chmodSync(binary, 0o755);

        // When - it runs over the paths, and over none
        const { failures } = runLsLint(binary, '', [
            'src/a.ts',
            '.cache/b/c.ts',
            'packages/m/package.json',
        ]);
        const bare = runLsLint(binary, '', []);

        // Then - the tree held those paths, each an empty file but the manifest, and an empty sweep still gives the tool a tree to run in
        expect([failures, bare]).toStrictEqual([
            { tree: { files: ['./.cache/b/c.ts:0 ./packages/m/package.json:3 ./src/a.ts:0 '] } },
            { failures: { tree: { files: [''] } }, problem: null },
        ]);
    });

    test('names a run that leaves no report, and a binary that is not there', () => {
        // Given - a config ls-lint cannot read
        const paths = ['src/a.ts'];

        // When - it runs with it, then a binary nowhere on disk runs
        const unread = runLsLint(LS_LINT, 'ls: [not a map\n', paths);
        const missing = runLsLint(join(tmpdir(), 'no-ls-lint'), '', paths);

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
                'found: ls-lint stopped with no report — … · why: where a name sits is judged from the failures ls-lint reports, and with no report no name is judged · fix: correct what ls-lint printed — an `--ignore-pattern` or a declared glob it cannot read, a directory it cannot enter — then run again · read: docs/reference/quality-checks.md#the-names-tree-pass',
            ],
            [
                {},
                "found: ls-lint could not be run — … · why: the pass hands the tree to ls-lint, and a tool that never ran judged nothing · fix: run 'npm install' so the ls-lint @jterrazz/typescript pins is installed beside it, then run again · read: docs/reference/quality-checks.md#the-passes",
            ],
        ]);
        expect([
            unread.problem?.includes('yaml: line 1:'),
            missing.problem?.endsWith('#the-passes'),
        ]).toStrictEqual([true, true]);
    });

    test('lsLintConfig — a skill holds references of its own, kebab-named markdown pages and no folder, in every unit', () => {
        // Given - the config of a root unit and of a member
        const config = parsedObject(
            lsLintConfig({
                ignorePatterns: [],
                trees: treesOf(['', 'apps/api/']),
                units: ['', 'apps/api/'],
            }),
        );
        const rules = objectOf(config.ls);

        // Then - the references folder of each unit refuses anything but pages named like a skill folder
        const references = [
            rules['skills/*/references'],
            rules['apps/api/skills/*/references'],
        ].map((one) => objectOf(one));
        expect(
            references.map((one) => [
                one['.*'],
                one['.dir'],
                String(one['.md']).startsWith('regex:'),
            ]),
        ).toStrictEqual([
            ['exists:0', 'exists:0', true],
            ['exists:0', 'exists:0', true],
        ]);
    });

    test('lsLintConfig — a module at the root of self/ is named in kebab-case and an entry at the root of lint/ is an index, whatever the module extension', () => {
        // Given - a kebab-case module and an index of each module extension, beside a page, a name off kebab-case and an entry that is no index
        const config = lsLintConfig({ ignorePatterns: [], trees: treesOf(['']), units: [''] });
        const refused = ['lint/reading.ts', 'lint/self/Reading_Order.ts', 'lint/self/notes.md'];
        const allowed = ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'].flatMap(
            (extension) => [`lint/self/reading-order${extension}`, `lint/index${extension}`],
        );

        // When - ls-lint runs over them
        const { failures } = runLsLint(LS_LINT, config, [...allowed, ...refused]);

        // Then - the refused ones alone
        expect(Object.keys(failures).toSorted()).toStrictEqual(refused);
    });
});
