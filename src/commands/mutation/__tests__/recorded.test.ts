import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { VERDICT_FILE } from '../../check/report/gate-verdict.js';
import { concluded, judgedRecorded, memberRecorded, recorder, stageRecorded } from '../recorded.js';

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

const NO_GLUE = { bar: 0.9, cap: 50, globs: [] };

const JUDGED = {
    detected: 4,
    detectedByFile: { 'src/a.ts': 4 },
    detectedBySuite: 1,
    ignoredBy: {},
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
        judgedRecorded(recorded, JUDGED, { glue: NO_GLUE, measure: { range: 'abc..HEAD' } });

        // Then - the numbers the verdict file carries, the survivor with its mutant, its report and its role
        expect(recorded.mutation).toStrictEqual({
            detected: 4,
            glue: { bar: 0.9, detected: 0, judged: 0, survivors: [] },
            range: 'abc..HEAD',
            survivors: [{ ...JUDGED.survivors[0], role: 'domain' }],
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
                        { mutator: 'Regex' },
                    ],
                    unrun: 1,
                },
            }),
        );
        memberVerdict(
            project,
            'apps/web',
            JSON.stringify({
                mutation: {
                    detected: 5,
                    glue: {
                        bar: 0.9,
                        detected: 4,
                        judged: 5,
                        survivors: [
                            {
                                column: 5,
                                file: 'src/infrastructure/a.ts',
                                line: 3,
                                mutator: 'StringLiteral',
                                replacement: '""',
                                report: '.artifacts/stryker/report.json',
                                role: 'glue',
                            },
                        ],
                    },
                    range: 'def..HEAD',
                    survivors: [],
                    unrun: 0,
                },
            }),
        );
        const recorded = recorder();
        memberRecorded(recorded, project, { member: 'apps/api', seconds: 2, status: 1 });
        memberRecorded(recorded, project, { member: 'apps/web', seconds: 3, status: 0 });

        // Then - three passes, and the two verdicts summed
        expect(recorded).toStrictEqual({
            mutation: {
                detected: 8,
                glue: {
                    bar: 0.9,
                    detected: 4,
                    judged: 5,
                    survivors: [
                        {
                            column: 5,
                            file: 'apps/web/src/infrastructure/a.ts',
                            line: 3,
                            mutator: 'StringLiteral',
                            replacement: '""',
                            report: 'apps/web/.artifacts/stryker/report.json',
                            role: 'glue',
                        },
                    ],
                },
                range: 'abc..HEAD, def..HEAD',
                survivors: [
                    { file: 'apps/api/src/a.ts', line: 2, mutator: 'StringLiteral' },
                    { file: 'apps/api/src/b.ts', line: 0, mutator: '' },
                    { file: 'apps/api/', line: 0, mutator: 'Regex' },
                ].map((survivor) => ({
                    ...survivor,
                    column: 0,
                    replacement: '',
                    report: 'apps/api/',
                    role: 'domain',
                })),
                unrun: 1,
            },
            passes: [
                {
                    firstError: 'apps/api failed; its verdict is above',
                    label: 'apps/api',
                    seconds: 2,
                    status: 1,
                },
                { firstError: null, label: 'apps/web', seconds: 3, status: 0 },
            ],
            reason: '',
        });
    });

    test('memberRecorded — a member whose verdict does not parse, judged nothing, or holds no mutation is a pass that adds no number', () => {
        // Given - a member that left a verdict file that is no JSON, one whose run judged nothing, and one holding no mutation at all
        const project = folder();
        memberVerdict(project, 'apps/broken', 'not json');
        memberVerdict(project, 'apps/none', JSON.stringify({ mutation: null }));
        memberVerdict(project, 'apps/bare', '{}');
        const recorded = recorder();
        memberRecorded(recorded, project, { member: 'apps/none', seconds: 1, status: 0 });
        memberRecorded(recorded, project, { member: 'apps/bare', seconds: 1, status: 0 });
        recorded.passes = [];
        memberRecorded(recorded, project, { member: 'apps/broken', seconds: 1, status: 1 });

        // Then - no numbers, and the broken member a failed pass
        expect(recorded).toStrictEqual({
            mutation: undefined,
            passes: [
                {
                    firstError: 'apps/broken failed; its verdict is above',
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
            glue: { bar: 0, detected: 0, judged: 0, survivors: [] },
            range: '',
            survivors: [],
            unrun: 0,
        });
    });

    test('concluded — writes the verdict file with the status the run returns, prints its last line in the colour of its verdict, and hands that status back', () => {
        // Given - a run refused before it measured anything, and one that passed measuring nothing
        const project = folder();
        const recorded = {
            ...recorder(),
            reason: 'refused before any run: git names no commit main',
        };
        const printed: string[] = [];
        const write = vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
            printed.push(String(text));

            return true;
        });
        onTestFinished(() => {
            write.mockRestore();
        });
        concluded(folder(), { ...recorder(), reason: 'measured nothing' }, 0);

        // Then - the status comes back, each line is printed red or green, and the verdict says the same
        expect(concluded(project, recorded, 1)).toBe(1);
        expect(printed).toStrictEqual([
            '\n\u001B[0;32m✓ Mutation passed: measured nothing\u001B[0m\n',
            '\n\u001B[0;31m✗ Mutation failed: refused before any run: git names no commit main\u001B[0m\n',
        ]);
        const written = readFileSync(join(project, VERDICT_FILE), 'utf8');
        expect(JSON.parse(written)).toStrictEqual({
            command: 'mutation',
            head: null,
            mutation: null,
            passes: [],
            status: 1,
        });
    });

    test('stageRecorded — each stage is a pass under its label; one Stryker stopped names its status, and is why the run judged nothing', () => {
        // Given - the module tests run through, then the whole suite stopped by Stryker
        const recorded = recorder();
        stageRecorded(recorded, 'modules', { seconds: 3, status: 0 });
        const reasonAfterModules = recorded.reason;
        stageRecorded(recorded, 'suite', { seconds: 9, status: 2 });

        // Then - two passes, and the suite's stop as the reason
        expect([reasonAfterModules, recorded]).toStrictEqual([
            '',
            {
                mutation: undefined,
                passes: [
                    { firstError: null, label: 'Mutation (module tests)', seconds: 3, status: 0 },
                    {
                        firstError: 'Stryker exited 2; its log is above',
                        label: 'Mutation (whole suite)',
                        seconds: 9,
                        status: 2,
                    },
                ],
                reason: 'Stryker stopped the whole suite with status 2; its log is above',
            },
        ]);
        stageRecorded(recorded, 'modules', { seconds: 1, status: 1 });
        expect(recorded.reason).toBe(
            'Stryker stopped the module tests with status 1; its log is above',
        );
    });

    test('stageRecorded — a stage the checker stopped on a tree that does not compile names the first compile error, as its first error and as the reason', () => {
        // Given - a module stage Stryker stopped while the compiler refuses the unmutated tree
        const recorded = recorder();
        stageRecorded(recorded, 'modules', {
            seconds: 4,
            status: 1,
            uncompiled: "src/b.ts:2 TS2322 Type 'string' is not assignable to type 'number'.",
        });

        // Then - the pass and the reason say the tree does not compile, at the compiler's first error
        const found =
            "the tree does not compile before any mutant: src/b.ts:2 TS2322 Type 'string' is not assignable to type 'number'.";
        expect(recorded).toStrictEqual({
            mutation: undefined,
            passes: [
                { firstError: found, label: 'Mutation (module tests)', seconds: 4, status: 1 },
            ],
            reason: found,
        });
    });
});
