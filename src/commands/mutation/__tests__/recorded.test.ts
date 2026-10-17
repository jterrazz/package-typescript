import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { VERDICT_FILE } from '../../check/report/gate-verdict.js';
import { concluded, judgedRecorded, memberRecorded, recorder } from '../recorded.js';

function folder(): string {
    const made = mkdtempSync(join(tmpdir(), 'mutation-recorded-'));
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

function memberVerdict(project: string, member: string, text: string): void {
    mkdirSync(join(project, member, '.artifacts/gate'), { recursive: true });
    writeFileSync(join(project, member, VERDICT_FILE), text);
}

const JUDGED = {
    detected: 4,
    detectedBySuite: 1,
    left: 2,
    outsideVerdict: {},
    survivors: [
        {
            column: 9,
            file: 'src/a.ts',
            line: 2,
            mutator: 'ConditionalExpression',
            replacement: 'false',
            report: '.artifacts/stryker/report.json',
        },
    ],
    uncoveredByFile: {},
    unrun: { Pending: 2, 'absent from the suite report': 1 },
};

describe('recorded', () => {
    test('judgedRecorded — the numbers of the verdict: what it detected, each survivor at its place, every mutant it never judged, over its range', () => {
        // Given - a verdict with one survivor and three mutants never judged
        const recorded = recorder();
        judgedRecorded(recorded, JUDGED, { range: 'abc..HEAD' });

        // Then - the numbers the verdict file carries
        expect(recorded.mutation).toStrictEqual({
            detected: 4,
            range: 'abc..HEAD',
            survivors: [{ file: 'src/a.ts', line: 2, mutator: 'ConditionalExpression' }],
            unrun: 3,
        });
    });

    test("memberRecorded — each member is a pass of the root's, and their numbers add up, each survivor named from the root", () => {
        // Given - two members that left a verdict over the same range, and one that left none
        const project = folder();
        memberVerdict(
            project,
            'apps/api',
            JSON.stringify({
                mutation: {
                    detected: 3,
                    range: 'abc..HEAD',
                    survivors: [
                        { file: 'src/a.ts', line: 2, mutator: 'StringLiteral' },
                        { file: 'src/b.ts', line: '4' },
                    ],
                    unrun: 1,
                },
            }),
        );
        memberVerdict(
            project,
            'apps/web',
            JSON.stringify({
                mutation: { detected: 5, range: 'def..HEAD', survivors: [], unrun: 0 },
            }),
        );
        memberVerdict(project, 'apps/broken', 'not json');
        const recorded = recorder();
        memberRecorded(recorded, project, { member: 'apps/api', seconds: 2, status: 1 });
        memberRecorded(recorded, project, { member: 'apps/web', seconds: 3, status: 0 });
        memberRecorded(recorded, project, { member: 'apps/broken', seconds: 1, status: 1 });

        // Then - three passes, and the two verdicts summed
        expect(recorded).toStrictEqual({
            mutation: {
                detected: 8,
                range: 'abc..HEAD, def..HEAD',
                survivors: [
                    { file: 'apps/api/src/a.ts', line: 2, mutator: 'StringLiteral' },
                    { file: 'apps/api/src/b.ts', line: 0, mutator: '' },
                ],
                unrun: 1,
            },
            passes: [
                {
                    firstError: 'apps/api failed — its verdict is above',
                    label: 'apps/api',
                    seconds: 2,
                    status: 1,
                },
                { firstError: null, label: 'apps/web', seconds: 3, status: 0 },
                {
                    firstError: 'apps/broken failed — its verdict is above',
                    label: 'apps/broken',
                    seconds: 1,
                    status: 1,
                },
            ],
            reason: '',
        });
    });

    test('memberRecorded — a verdict file missing its fields counts nothing of what it lacks', () => {
        // Given - a member whose verdict holds a mutation of no fields
        const project = folder();
        memberVerdict(project, 'apps/api', JSON.stringify({ mutation: {} }));
        const recorded = recorder();
        memberRecorded(recorded, project, { member: 'apps/api', seconds: 2, status: 0 });

        // Then - its numbers read as nothing
        expect(recorded.mutation).toStrictEqual({
            detected: 0,
            range: '',
            survivors: [],
            unrun: 0,
        });
    });

    test('concluded — writes the verdict file with the status the run returns, and hands that status back', () => {
        // Given - a run refused before it measured anything
        const project = folder();
        const recorded = {
            ...recorder(),
            reason: 'refused before any run: git names no commit main',
        };

        // Then - the status comes back, and the verdict says the same
        expect(concluded(project, recorded, 1)).toBe(1);
        const written = readFileSync(join(project, VERDICT_FILE), 'utf8');
        expect(JSON.parse(written)).toStrictEqual({
            command: 'mutation',
            head: null,
            mutation: null,
            passes: [],
            status: 1,
        });
    });
});
