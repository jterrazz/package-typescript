import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { recordInputs } from '../incremental.js';
import { inputsOf } from '../inputs.js';
import { observedFrom, ranBy } from '../observed.js';
import { scriptRunOf, testFilesOf, testFilesReachedIn, testScriptOf } from '../test-files.js';

const OBSERVED = observedFrom([
    { loaded: ['src/cli.ts', 'src/b.ts'], ran: ['src/cli.ts'], test: 'specs/a.spec.ts#a runs a' },
    { loaded: ['src/cli.ts', 'src/b.ts'], ran: ['src/b.ts'], test: 'specs/b.spec.ts#b runs b' },
    { loaded: [], ran: [], test: 'src/__tests__/x.test.ts#x imports x' },
    { test: 'specs/blind.spec.ts#blind is not followed' },
]);

const INPUTS = Object.fromEntries(
    [
        'package.json',
        'specs/a.spec.ts',
        'specs/b.spec.ts',
        'specs/blind.spec.ts',
        'specs/__fixtures__/b/input.txt',
        'specs/new.spec.ts',
        'src/__tests__/x.test.ts',
        'src/b.ts',
        'src/cli.ts',
        'src/x.ts',
        'docs/guide.md',
    ].map((path) => [path, 'hash']),
);

const STALENESS = {
    onlyFunctions: () => false,
    ranBy: ranBy(OBSERVED),
    reach: (file: string) => ({
        everything: false,
        files: new Set(file === 'src/__tests__/x.test.ts' ? ['src/x.ts'] : []),
    }),
};

const filesFor = (changed: readonly string[], inputs = INPUTS): ReturnType<typeof testFilesOf> =>
    testFilesOf({ changed, inputs, observed: OBSERVED, staleness: STALENESS });

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

function projectOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'test-files-'));
    created.push(root);
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    const git = (...args: string[]): void => {
        execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root });
    };
    git('init', '--quiet', '--initial-branch=main');
    git('add', '--all');
    git('commit', '--quiet', '--message', 'first');

    return root;
}

const VITEST_PROJECT = {
    '.gitignore': '.artifacts/\n',
    'package.json': '{"name":"p","scripts":{"test":"vitest --run"}}',
    'specs/a.spec.ts': 'spec',
    'src/__tests__/x.test.ts': "import { x } from '../x.js';",
    'src/__tests__/y.test.ts': "import { y } from '../y.js';",
    'src/x.ts': 'export const x = 1;',
    'src/y.ts': 'export const y = 1;',
};

function recorded(root: string): void {
    const inputs = inputsOf(root) ?? {};
    mkdirSync(join(root, '.artifacts/stryker'), { recursive: true });
    recordInputs(root, 'suite-incremental', {
        inputs,
        observed: observedFrom([
            { loaded: [], ran: [], test: 'specs/a.spec.ts#a' },
            { loaded: [], ran: [], test: 'src/__tests__/x.test.ts#x' },
            { loaded: [], ran: [], test: 'src/__tests__/y.test.ts#y' },
        ]),
    });
}

describe('test-files', () => {
    test('testFilesOf — runs the files a changed source reaches, the blind ones, and every file the record does not know', () => {
        // Given - a record of a spec that only loads b, one that runs b, a module test of x, a spec it could not follow, and a spec added since

        // When - b changes, then x
        const b = filesFor(['src/b.ts']);
        const x = filesFor(['src/x.ts']);

        // Then - b reaches both specs that loaded it, x only its module test; the blind spec and the new one run either way
        expect([b, x]).toStrictEqual([
            {
                files: [
                    'specs/a.spec.ts',
                    'specs/b.spec.ts',
                    'specs/blind.spec.ts',
                    'specs/new.spec.ts',
                ],
                kind: 'reached',
                total: 5,
            },
            {
                files: ['specs/blind.spec.ts', 'specs/new.spec.ts', 'src/__tests__/x.test.ts'],
                kind: 'reached',
                total: 5,
            },
        ]);
    });

    test('testFilesOf — a changed test runs itself, a changed fixture the tests under its folder, and neither the blind ones', () => {
        // Given - the same record

        // When - a module test changes, then a fixture under specs/
        const own = filesFor(['src/__tests__/x.test.ts']);
        const ground = filesFor(['specs/__fixtures__/b/input.txt']);

        // Then - the changed test alone beside the one the record does not know, then every spec
        expect([own, ground]).toStrictEqual([
            { files: ['specs/new.spec.ts', 'src/__tests__/x.test.ts'], kind: 'reached', total: 5 },
            {
                files: [
                    'specs/a.spec.ts',
                    'specs/b.spec.ts',
                    'specs/blind.spec.ts',
                    'specs/new.spec.ts',
                ],
                kind: 'reached',
                total: 5,
            },
        ]);
    });

    test('testFilesOf — runs every file where the change reaches a file every test reads, removes a module, or the record knows no test', () => {
        // Given - the same record

        // When - the manifest changes, a page of the manual, a module is removed, and a record whose every test is gone
        const outcomes = [
            filesFor(['src/x.ts', 'package.json']),
            filesFor(['docs/guide.md']),
            filesFor(['src/gone.ts']),
            filesFor(['src/x.ts'], { 'src/x.ts': 'hash' }),
        ];

        // Then - each says why every file runs
        expect(outcomes).toStrictEqual([
            { kind: 'every', reason: 'the change reaches package.json, which every test reads' },
            { kind: 'every', reason: 'the change reaches docs/guide.md, which every test reads' },
            {
                kind: 'every',
                reason: 'the change removes src/gone.ts, and no record names the tests that import it',
            },
            { kind: 'every', reason: 'the record of the last dry run names no test' },
        ]);
    });

    test('testFilesOf — a removed test file or fixture names no module a test imports, and runs what it reaches', () => {
        // Given - the same record

        // When - a spec is deleted, then a fixture
        const spec = filesFor(['specs/gone.spec.ts']);
        const fixture = filesFor(['specs/__fixtures__/gone.txt']);

        // Then - the deleted spec runs nothing more; the fixture's folder runs
        expect([spec.kind, fixture.kind]).toStrictEqual(['reached', 'reached']);
        expect(spec).toMatchObject({ files: ['specs/new.spec.ts'] });
    });

    test('testFilesReachedIn — reads the suite record and the change since the branch base: a one-file change runs its reacher alone', () => {
        // Given - a vitest project recorded at its first commit, on a branch whose one change is y
        const root = projectOf(VITEST_PROJECT);
        recorded(root);
        execFileSync('git', ['switch', '--quiet', '--create', 'work'], { cwd: root });
        writeFileSync(join(root, 'src/y.ts'), 'export const y = 2;');

        // Then - y's module test alone, of the three test files
        expect(testFilesReachedIn(root)).toStrictEqual({
            files: ['src/__tests__/y.test.ts'],
            kind: 'reached',
            total: 3,
        });
    });

    test('testFilesReachedIn — a change the branch committed since its base counts though the record was taken after it', () => {
        // Given - a vitest project whose branch commits a change to x, recorded after that commit
        const root = projectOf(VITEST_PROJECT);
        execFileSync('git', ['switch', '--quiet', '--create', 'work'], { cwd: root });
        writeFileSync(join(root, 'src/x.ts'), 'export const x = 2;');
        execFileSync(
            'git',
            ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--quiet', '--all', '-m', 'x'],
            {
                cwd: root,
            },
        );
        recorded(root);

        // Then - x's module test runs, from the change since the base
        expect(testFilesReachedIn(root)).toMatchObject({ files: ['src/__tests__/x.test.ts'] });
    });

    test('testFilesReachedIn — runs every file with no record, a test script that is not one vitest command, a workspace root, and no repository', () => {
        // Given - a project with no record, one whose script chains a second command, a workspace root, and a folder git does not know
        const unrecorded = projectOf(VITEST_PROJECT);
        const chained = projectOf({
            ...VITEST_PROJECT,
            'package.json': '{"name":"p","scripts":{"test":"vitest --run && tsc"}}',
        });
        recorded(chained);
        const workspace = projectOf({
            'package.json': '{"name":"root","workspaces":["apps/*"]}',
            'apps/a/package.json': '{"name":"a"}',
        });
        const nowhere = mkdtempSync(join(tmpdir(), 'test-files-'));
        created.push(nowhere);
        writeFileSync(join(nowhere, 'package.json'), '{"name":"p","scripts":{"test":"vitest"}}');
        mkdirSync(join(nowhere, '.artifacts/stryker'), { recursive: true });
        recordInputs(nowhere, 'suite-incremental', { inputs: {} });

        // Then - each says why
        expect(
            [unrecorded, chained, workspace, nowhere].map((root) => testFilesReachedIn(root)),
        ).toStrictEqual([
            {
                kind: 'every',
                reason: 'no record of what each test reaches, which `typescript mutation` leaves',
            },
            {
                kind: 'every',
                reason: 'the test script is not one vitest command, so it cannot be handed the files',
            },
            { kind: 'every', reason: 'a workspace root, whose members each keep their own record' },
            {
                kind: 'every',
                reason: 'no record of what each test reaches, which `typescript mutation` leaves',
            },
        ]);
    });

    test('testScriptOf — the test script trimmed, and empty where the project keeps none', () => {
        // Given - a project with a test script, and one with no manifest
        const scripted = projectOf({ 'package.json': '{"scripts":{"test":" vitest --run "}}' });
        const bare = mkdtempSync(join(tmpdir(), 'test-files-'));
        created.push(bare);

        // Then - the script, then nothing
        expect([testScriptOf(scripted), testScriptOf(bare)]).toStrictEqual(['vitest --run', '']);
    });

    test('scriptRunOf — hands the script the files reached with --passWithNoTests once, nothing for every file, and runs nothing where none is reached', () => {
        // Given - a selection of two of five files, of five of five, of none, and every file for a reason
        const two = { files: ['a.test.ts', 'b.test.ts'], kind: 'reached', total: 5 } as const;

        // Then - the flag added where the script does not already say it, and a line for each
        expect([
            scriptRunOf(two, 'vitest --run'),
            scriptRunOf(two, 'vitest --run --passWithNoTests'),
            scriptRunOf({ files: ['a', 'b', 'c', 'd', 'e'], kind: 'reached', total: 5 }, 'vitest'),
            scriptRunOf({ files: [], kind: 'reached', total: 5 }, 'vitest'),
            scriptRunOf({ kind: 'every', reason: 'asked --cold' }, 'vitest'),
        ]).toStrictEqual([
            {
                args: ['--passWithNoTests', 'a.test.ts', 'b.test.ts'],
                line: 'ran 2 of 5 test files the change reaches',
            },
            { args: ['a.test.ts', 'b.test.ts'], line: 'ran 2 of 5 test files the change reaches' },
            { args: [], line: 'ran 5 of 5 test files the change reaches' },
            { args: undefined, line: 'ran 0 of 5 test files the change reaches' },
            { args: [], line: 'ran every test file: asked --cold' },
        ]);
    });
});
