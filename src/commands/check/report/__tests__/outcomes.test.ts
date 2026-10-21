import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
    fileOutcomesOf,
    fileResultsOf,
    outcomesRecorded,
    passOutcomesOf,
    testOutcomeOf,
} from '../outcomes.js';
import type { Outcome } from '../outcomes.js';

const projects: string[] = [];

function projectDirectory(): string {
    const project = mkdtempSync(join(tmpdir(), 'outcomes-'));
    projects.push(project);

    return project;
}

afterEach(() => {
    for (const project of projects.splice(0)) {
        rmSync(project, { force: true, recursive: true });
    }
});

const NOW = new Date('2026-10-21T12:00:00.000Z');

const outcome = (name: string, at: string): Outcome => ({
    at,
    command: 'check',
    head: 'abc',
    kind: 'pass',
    name,
    seconds: 1,
    status: 'green',
});

const linesIn = (project: string): unknown[] =>
    readFileSync(join(project, '.artifacts/check/outcomes.jsonl'), 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line): unknown => JSON.parse(line));

const resultsCache = (results: unknown): string => JSON.stringify({ results, version: '5.0.1' });

describe('outcomes', () => {
    test('outcomesRecorded — appends each outcome as one line, and writes no file for a run that ended on none', () => {
        // Given - a project, an empty record, then two runs
        const project = projectDirectory();
        outcomesRecorded(project, [], NOW);
        const nothing = existsSync(join(project, '.artifacts/check/outcomes.jsonl'));
        outcomesRecorded(project, [outcome('Oxlint Check', NOW.toISOString())], NOW);
        outcomesRecorded(project, [outcome('Tests', NOW.toISOString())], NOW);

        // Then - no file for nothing, then both, in the order they ended
        expect(nothing).toBe(false);
        expect(linesIn(project)).toStrictEqual([
            outcome('Oxlint Check', NOW.toISOString()),
            outcome('Tests', NOW.toISOString()),
        ]);
    });

    test('outcomesRecorded — drops what ended more than thirty days ago, and keeps a line it cannot date', () => {
        // Given - a record opening on a line torn by a crash, then a line 31 days old, and one 29 days old
        const project = projectDirectory();
        mkdirSync(join(project, '.artifacts/check'), { recursive: true });
        writeFileSync(
            join(project, '.artifacts/check/outcomes.jsonl'),
            [
                '{"at":',
                JSON.stringify(outcome('old', '2026-09-20T12:00:00.000Z')),
                JSON.stringify(outcome('kept', '2026-09-22T12:00:00.000Z')),
                '',
            ].join('\n'),
        );

        // When - a run ends
        outcomesRecorded(project, [outcome('new', NOW.toISOString())], NOW);

        // Then - the old line is gone, the rest kept in order
        const kept = JSON.stringify(outcome('kept', '2026-09-22T12:00:00.000Z'));
        const added = JSON.stringify(outcome('new', NOW.toISOString()));
        expect(
            readFileSync(join(project, '.artifacts/check/outcomes.jsonl'), 'utf8').split('\n'),
        ).toStrictEqual(['{"at":', kept, added, '']);
    });

    test('outcomesRecorded — leaves the record as it is while its first line is within thirty days', () => {
        // Given - a record whose first line is exactly thirty days old, beside a later one
        const project = projectDirectory();
        mkdirSync(join(project, '.artifacts/check'), { recursive: true });
        const edge = JSON.stringify(outcome('edge', '2026-09-21T12:00:00.000Z'));
        writeFileSync(join(project, '.artifacts/check/outcomes.jsonl'), `${edge}\n`);

        // When - a run ends
        outcomesRecorded(project, [outcome('new', NOW.toISOString())], NOW);

        // Then - nothing is dropped
        expect(linesIn(project)).toStrictEqual([
            outcome('edge', '2026-09-21T12:00:00.000Z'),
            outcome('new', NOW.toISOString()),
        ]);
    });

    test('passOutcomesOf — names each pass of a verdict green or red, with its seconds, under the command and the commit', () => {
        // Given - a mutation verdict of two stages, the second red
        const outcomes = passOutcomesOf(
            {
                command: 'mutation',
                head: 'abc',
                mutation: null,
                passes: [
                    { firstError: null, label: 'Mutation (module tests)', seconds: 3.2, status: 0 },
                    { firstError: 'x', label: 'Mutation (whole suite)', seconds: 9.5, status: 1 },
                ],
                status: 1,
            },
            NOW,
        );

        // Then - one outcome per stage
        expect(outcomes).toStrictEqual([
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'mutation',
                head: 'abc',
                kind: 'pass',
                name: 'Mutation (module tests)',
                seconds: 3.2,
                status: 'green',
            },
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'mutation',
                head: 'abc',
                kind: 'pass',
                name: 'Mutation (whole suite)',
                seconds: 9.5,
                status: 'red',
            },
        ]);
    });

    test('testOutcomeOf — names a test run a pass of its own, red on any status but 0', () => {
        // Given - a run that passed and one that failed
        // Then - green, then red
        expect([
            testOutcomeOf({ head: null, seconds: 2.5, status: 0 }, NOW),
            testOutcomeOf({ head: 'abc', seconds: 4, status: 2 }, NOW).status,
        ]).toStrictEqual([
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'test',
                head: null,
                kind: 'pass',
                name: 'Tests',
                seconds: 2.5,
                status: 'green',
            },
            'red',
        ]);
    });

    test("fileResultsOf — reads Vitest's results under the preset's cache folder and Vite's default one, and skips one it cannot parse", () => {
        // Given - a project holding a cache in each folder, and a torn one
        const project = projectDirectory();
        const preset = join(project, '.artifacts/vitest/vitest/da39');
        const vite = join(project, 'node_modules/.vite/vitest/e3b0');
        const torn = join(project, 'node_modules/.vite/vitest/ffff');
        for (const folder of [preset, vite, torn]) {
            mkdirSync(folder, { recursive: true });
        }
        writeFileSync(
            join(preset, 'results.json'),
            resultsCache([['unit:src/a.test.ts', { duration: 12.5, failed: false }]]),
        );
        writeFileSync(
            join(vite, 'results.json'),
            resultsCache([[':specs/b.spec.ts', { duration: 3, failed: true }]]),
        );
        writeFileSync(join(torn, 'results.json'), '{"results":[');
        mkdirSync(join(project, 'node_modules/.vite/vitest/empty'));

        // Then - both caches' entries, each as its text
        expect(fileResultsOf(project)).toStrictEqual(
            new Map([
                ['unit:src/a.test.ts', '{"duration":12.5,"failed":false}'],
                [':specs/b.spec.ts', '{"duration":3,"failed":true}'],
            ]),
        );
        expect(fileResultsOf(projectDirectory())).toStrictEqual(new Map());
    });

    test('fileOutcomesOf — names each file a run added or changed the result of, by its project and path, and none it left as it was', () => {
        // Given - a file unchanged, one run again, one new and red, one in no project
        const before = new Map([
            ['unit:src/kept.test.ts', '{"duration":5,"failed":false}'],
            ['cli:specs/again.spec.ts', '{"duration":900,"failed":false}'],
        ]);
        const after = new Map([
            ['unit:src/kept.test.ts', '{"duration":5,"failed":false}'],
            ['cli:specs/again.spec.ts', '{"duration":1200,"failed":false}'],
            ['cli:specs/new.spec.ts', '{"duration":250,"failed":true}'],
            [':C:specs/odd.spec.ts', '{"duration":0}'],
        ]);

        // Then - the three this run wrote, in seconds
        expect(fileOutcomesOf({ after, before }, { head: 'abc', now: NOW })).toStrictEqual([
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'test',
                head: 'abc',
                kind: 'file',
                name: 'specs/again.spec.ts',
                project: 'cli',
                seconds: 1.2,
                status: 'green',
            },
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'test',
                head: 'abc',
                kind: 'file',
                name: 'specs/new.spec.ts',
                project: 'cli',
                seconds: 0.25,
                status: 'red',
            },
            {
                at: '2026-10-21T12:00:00.000Z',
                command: 'test',
                head: 'abc',
                kind: 'file',
                name: 'C:specs/odd.spec.ts',
                project: '',
                seconds: 0,
                status: 'green',
            },
        ]);
    });
});
