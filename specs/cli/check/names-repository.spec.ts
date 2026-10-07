import { directory, file } from '@jterrazz/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { git, repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';
import { formOnly } from './__setup__/oxlint-forms.js';

function selected(passes: Record<string, null | string> = {}) {
    return cli.with({ env: passes });
}

const project = (passes: Record<string, null | string> = {}) =>
    selected(passes).fixture(directory('../__fixtures__/names/repository/project/'));

const names = (makefile?: 'four' | 'more' | 'six') => {
    const chain = project(onlyPasses('names'));
    return makefile === undefined
        ? chain
        : chain.fixture(file(`../__fixtures__/names/repository/makefiles/${makefile}/Makefile`));
};

const TREE_PASSES = onlyPasses('suppressions', 'markdown', 'names', 'secrets');

/** The four tree gates, the linter answering in its compact form whatever the machine's environment picks. */
const GATES = {
    ...formOnly({ AI_AGENT: 'spec' }),
    ...onlyPasses('oxlint', 'markdown', 'names', 'secrets'),
};

/** A folder nobody has added: notes linking nowhere and carrying a key, and a debugger. */
function dataFolder(workdir: string): void {
    mkdirSync(join(workdir, 'data'));
    // hazard: spelled in two halves, so this file carries no key of its own.
    const key = ['AKIA', 'Q7RJ4KDNPZ2WX6TB'].join('');
    writeFileSync(
        join(workdir, 'data/NOTES.md'),
        `# Scratch\n\nSee [the plan](./missing.md) and the key ${key}.\n`,
    );
    writeFileSync(
        join(workdir, 'data/scratch.ts'),
        'export function stop(): void {\n    debugger;\n}\n',
    );
}

/** The same folder, and a generated src/Api_Client/, both named in .gitignore. */
function ignoredFolders(workdir: string): void {
    dataFolder(workdir);
    mkdirSync(join(workdir, 'src/Api_Client'), { recursive: true });
    writeFileSync(join(workdir, 'src/Api_Client/client.ts'), 'export const client = 1;\n');
    writeFileSync(join(workdir, '.gitignore'), 'data/\nsrc/Api_Client/\n');
}

function initialised(workdir: string): void {
    git(workdir, 'init', '--quiet');
}

describe('names-repository', () => {
    test('judges an untracked folder git does not ignore in every tree gate, the linter included', async () => {
        // Given - a green repository, and a data/ folder nobody has added and nothing ignores
        // When - the quality checks run
        const result = await project(GATES)
            .fixture(file('../__fixtures__/names/repository/makefiles/six/Makefile'))
            .prepare(repository)
            .prepare(dataFolder)
            .exec('check');

        // Then - every gate reads the folder: each fails, naming what it holds
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            data/scratch.ts:2:5: error eslint(no-debugger): \`debugger\` statement is not allowed help: Remove the debugger statement
            ✗ Failed with exit code 1

             RUN  Markdown (prose)

            data/NOTES.md:3:16: [MD057] Relative link './missing.md' does not exist
            ✗ Failed with exit code 1

             RUN  Names (tree)

            data/:1:1: error names(no-undeclared-root-folder): found: \`data/\` is a root outside the spine · why: Every root folder is on the root spine, imposed by a tool, or declared with its reason. · fix: move it under src/, or declare it in jterrazz.config.ts's \`typescript.roots\` with its reason · read: docs/reference/quality-checks.md#a-root-beside-the-spine
            found: every finding above, and .jterrazz/baseline.json records no \`names/\` entry in its \`typescript\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/quality-checks.md#what-jterrazzbaselinejson-still-holds
            ✗ Failed with exit code 1

             RUN  Secrets (credentials)

            data/NOTES.md:3:1: error secrets(no-aws-key): line 3 looks like an aws access key
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('records what an untracked folder holds: the linter in its own file, the root folder in the section', async () => {
        // Given - the same repository and data/ folder
        // When - the baseline is recorded
        const result = await project()
            .fixture(file('../__fixtures__/names/repository/makefiles/six/Makefile'))
            .prepare(repository)
            .prepare(dataFolder)
            .exec('baseline');

        // Then - oxlint holds the debugger, the section the undeclared root folder
        expect({
            baseline: result.file('.jterrazz/baseline.json').content,
            suppressed: result.file('.jterrazz/oxlint-suppressions.json').content,
        }).toStrictEqual({
            baseline:
                '{\n    "typescript": {\n        "names/no-undeclared-root-folder": 1\n    }\n}\n',
            suppressed:
                '{\n    "data/scratch.ts": {\n        "no-debugger": {\n            "count": 1\n        }\n    }\n}\n',
        });
    });

    test('judges no folder git ignores, in any tree gate, the linter included', async () => {
        // Given - the same repository and data/ folder, the folder and a generated src/Api_Client/ named in .gitignore
        // When - the quality checks run
        const result = await project(GATES)
            .fixture(file('../__fixtures__/names/repository/makefiles/six/Makefile'))
            .prepare(repository)
            .prepare(ignoredFolders)
            .exec('check');

        // Then - no gate reads the ignored folders: each pass is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            ✓ Passed

             RUN  Markdown (prose)

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             RUN  Secrets (credentials)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('records nothing for folders git ignores, so the baseline is no file', async () => {
        // Given - the same repository and its ignored folders
        // When - the baseline is recorded
        const result = await project()
            .fixture(file('../__fixtures__/names/repository/makefiles/six/Makefile'))
            .prepare(repository)
            .prepare(ignoredFolders)
            .exec('baseline');

        // Then - neither ledger is written
        expect(
            ['.jterrazz/baseline.json', '.jterrazz/oxlint-suppressions.json'].map(
                (path) => result.file(path).exists,
            ),
        ).toStrictEqual([false, false]);
    });

    test('judges a repository nobody has added a file to yet, its Makefile included', async () => {
        // Given - a repository initialised over a tree nobody has added
        // When - the quality checks run
        const result = await names('six').prepare(initialised).exec('check');

        // Then - the new Makefile answers the contract, and the Names pass is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/names-green.txt'));
    });

    test('refuses to judge a repository whose every file git ignores, in one line that says what to do', async () => {
        // Given - a repository whose .gitignore ignores every file, itself included
        // When - the tree gates run
        const result = await project(TREE_PASSES)
            .fixture(file('../__fixtures__/names/repository/makefiles/six/Makefile'))
            .prepare((workdir) => {
                writeFileSync(join(workdir, '.gitignore'), '*\n');
                initialised(workdir);
            })
            .exec('check');

        // Then - every tree gate says that one line, and no stack, and the run fails where a silent gate would pass on everything
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Suppressions (directives)

            found: nothing to read under {{workdir}}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Markdown (prose)

            found: nothing to read under {{workdir}}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Names (tree)

            found: nothing to read under {{workdir}}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Secrets (credentials)

            found: nothing to read under {{workdir}}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('refuses to judge a directory outside git that holds folders and no file, in one line', async () => {
        // Given - a directory no repository holds, with one empty folder in it
        // When - the tree gates run
        const result = await selected(TREE_PASSES)
            .prepare((workdir) => {
                mkdirSync(join(workdir, 'src'));
            })
            .exec('check');

        // Then - every tree gate says that one line, and the run fails
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Suppressions (directives)

            found: nothing to read under {{workdir}}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Markdown (prose)

            found: nothing to read under {{workdir}}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Names (tree)

            found: nothing to read under {{workdir}}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             RUN  Secrets (credentials)

            found: nothing to read under {{workdir}}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('accepts a repository whose Makefile answers the six gestures', async () => {
        // Given - a repository whose Makefile writes a rule for each of the six
        // When - the quality checks run
        const result = await names('six').prepare(repository).exec('check');

        // Then - the contract holds, and the Names pass is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/names-green.txt'));
    });

    test('accepts a repository whose Makefile answers more than the six gestures', async () => {
        // Given - a repository whose Makefile writes the six, then a test-mobile and a release of its own
        // When - the quality checks run
        const result = await names('more').prepare(repository).exec('check');

        // Then - the contract only requires, so the extra targets are no finding, and the Names pass is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/names-green.txt'));
    });

    test('names each gesture a repository Makefile has no rule for', async () => {
        // Given - a Makefile with no fix and no check, an assignment and a comment standing in for them
        // When - the quality checks run
        const result = await names('four').prepare(repository).exec('check');

        // Then - the two missing gestures are named, one finding each, and the pass fails
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Names (tree)

            Makefile:1:1: error names(makefile-answers-every-gesture): found: \`make fix\` has no rule · why: The Makefile writes a rule for each of the six gestures. · fix: write its rule — every repository answers \`make\` install, build, lint, fix, test and check · read: docs/reference/quality-checks.md#the-six-gestures
            Makefile:1:1: error names(makefile-answers-every-gesture): found: \`make check\` has no rule · why: The Makefile writes a rule for each of the six gestures. · fix: write its rule — every repository answers \`make\` install, build, lint, fix, test and check · read: docs/reference/quality-checks.md#the-six-gestures
            found: every finding above, and .jterrazz/baseline.json records no \`names/\` entry in its \`typescript\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/quality-checks.md#what-jterrazzbaselinejson-still-holds
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('refuses a repository with no Makefile at all', async () => {
        // Given - a repository with no Makefile
        // When - the quality checks run
        const result = await names().prepare(repository).exec('check');

        // Then - the absence is one finding
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/no-makefile.txt'));
    });

    test('passes a linter run whatever the Names pass would say', async () => {
        // Given - a repository with no Makefile, which the Names pass refuses and the linter does not
        // When - the linter alone runs
        const result = await project(onlyPasses('oxlint')).prepare(repository).exec('check');

        // Then - the Names pass does not run: it prints nothing and weighs nothing in the verdict
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('refuses a repository whose tracked Makefile is deleted from the disk', async () => {
        // Given - a repository that tracks a Makefile, since deleted and not yet committed
        // When - the quality checks run
        const result = await names('six')
            .prepare(repository)
            .prepare((workdir) => {
                rmSync(join(workdir, 'Makefile'));
            })
            .exec('check');

        // Then - the deleted file answers nothing, and the absence is one finding
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/no-makefile.txt'));
    });

    test('asks a directory that is no repository for nothing', async () => {
        // Given - the same tree with no Makefile, and no repository around it
        // When - the quality checks run
        const result = await names().exec('check');

        // Then - a workspace member or a bare directory owes the root's gestures nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/names-repository/names-green.txt'));
    });

    test('records a missing gesture in the ratchet, and the run it records is green', async () => {
        // Given - a repository missing two gestures, recorded by the baseline command
        // When - the linter and the Names pass run after it
        const result = await project(onlyPasses('oxlint', 'names'))
            .fixture(file('../__fixtures__/names/repository/makefiles/four/Makefile'))
            .prepare(repository)
            .exec(['baseline', 'check']);

        // Then - the entry holds both, and the Names pass is green
        expect(result.file('.jterrazz/baseline.json').content).toBe(
            '{\n    "typescript": {\n        "names/makefile-answers-every-gesture": 2\n    }\n}\n',
        );
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });
});
