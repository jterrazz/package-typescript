import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import {
    checkSummaryOf,
    checkVerdictOf,
    driftPassOf,
    firstFindingOf,
    headOf,
    mutationSummaryOf,
    passVerdictOf,
    VERDICT_FILE,
    verdictLineOf,
    verdictWritten,
} from '../gate-verdict.js';

const read = (log: string): string => `\n${log}: the first finding\nthe second\n`;

const pass = (label: string, status: number, firstError: null | string = null) => ({
    firstError,
    label,
    seconds: 1.5,
    status,
});

function folder(): string {
    const made = mkdtempSync(join(tmpdir(), 'gate-verdict-'));
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

describe('gate-verdict', () => {
    test('firstFindingOf — the first line that says anything, its colours and margins gone, and none for a silent log', () => {
        // Given - a log opening on blank lines then a coloured finding, and a log of blanks
        const logs = [
            '\n  \n\u001B[0;31m  src/a.ts:1:1: error x(rule): found\u001B[0m\nnext\n',
            '\n \n',
        ];

        // Then - the finding, then nothing
        expect(logs.map((log) => firstFindingOf(log))).toStrictEqual([
            'src/a.ts:1:1: error x(rule): found',
            null,
        ]);
    });

    test('checkSummaryOf — the first failing pass and its first finding; a pass with no finding by its label; a red run with no failing pass as it is; a green run as green', () => {
        // Given - a run whose second and third passes failed, one where the drift report alone failed, a red run with no failing pass, and a green one
        // Then - each run reads in one line
        expect([
            checkSummaryOf({
                passes: [
                    pass('Config (one file)', 0),
                    pass('Oxlint Check', 1, 'src/a.ts:1:1: error x(rule)'),
                    pass('Knip (unused code)', 1, 'Unused files (1)'),
                ],
                status: 1,
            }),
            checkSummaryOf({ passes: [pass('Drift (profile)', 1)], status: 1 }),
            checkSummaryOf({ passes: [pass('Config (one file)', 0)], status: 1 }),
            checkSummaryOf({ passes: [pass('Config (one file)', 0)], status: 0 }),
        ]).toStrictEqual([
            '✗ Some checks failed, first Oxlint Check: src/a.ts:1:1: error x(rule)',
            '✗ Some checks failed, first Drift (profile)',
            '✗ Some checks failed',
            '✓ All checks passed',
        ]);
    });

    test("mutationSummaryOf — the verdict's own numbers and its first survivor, or why it judged nothing", () => {
        // Given - a red verdict with two survivors, a green one, and two runs that judged nothing
        const red = {
            detected: 7,
            range: 'abc..HEAD',
            survivors: [
                { file: 'src/a.ts', line: 2, mutator: 'ConditionalExpression' },
                { file: 'src/b.ts', line: 9, mutator: 'StringLiteral' },
            ],
            unrun: 1,
        };

        // Then - each reads in one line
        expect([
            mutationSummaryOf(1, red),
            mutationSummaryOf(0, { ...red, survivors: [], unrun: 0 }),
            mutationSummaryOf(1, { ...red, survivors: [] }),
            mutationSummaryOf(0, 'measured nothing: no test project'),
            mutationSummaryOf(1, 'refused before any run: git names no commit main'),
        ]).toStrictEqual([
            '✗ Mutation failed: first survivor src/a.ts:2 ConditionalExpression; 7 detected, 2 surviving, 1 never judged, over abc..HEAD',
            '✓ Mutation passed: 7 detected, 0 surviving, 0 never judged, over abc..HEAD',
            '✗ Mutation failed: 7 detected, 0 surviving, 1 never judged, over abc..HEAD',
            '✓ Mutation passed: measured nothing: no test project',
            '✗ Mutation failed: refused before any run: git names no commit main',
        ]);
    });

    test('headOf — the commit a repository stands on, and none outside one or before its first commit', () => {
        // Given - a folder in no repository, then a repository before and after its first commit
        const project = folder();
        const outside = headOf(project);
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        const unborn = headOf(project);
        execFileSync(
            'git',
            [
                '-c',
                'user.email=t@t',
                '-c',
                'user.name=t',
                'commit',
                '--quiet',
                '--allow-empty',
                '-m',
                'first',
            ],
            { cwd: project },
        );
        const head = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: project,
            encoding: 'utf8',
        }).trim();

        // Then - nothing, nothing, then that commit
        expect([outside, unborn, headOf(project)]).toStrictEqual([null, null, head]);
    });

    test('verdictWritten — the verdict lands as JSON under .artifacts/gate/, its folder made, a verdict before it replaced', () => {
        // Given - a project with no .artifacts/, written twice
        const project = folder();
        const verdict = {
            command: 'check' as const,
            head: null,
            mutation: null,
            passes: [pass('Config (one file)', 0)],
            status: 0,
        };
        verdictWritten(project, { ...verdict, status: 1 });
        verdictWritten(project, verdict);

        // Then - the second, as JSON, at the path every gate reads
        expect(VERDICT_FILE).toBe('.artifacts/gate/verdict.json');
        expect(readFileSync(join(project, VERDICT_FILE), 'utf8')).toBe(
            `${JSON.stringify(verdict, null, 4)}\n`,
        );
    });

    test('passVerdictOf and driftPassOf — a failed pass names its first finding, read from its log, the drift report where to read it; a pass that passed names none', () => {
        // Given - a log reader, two passes and two drift reports

        // Then - each entry
        expect([
            passVerdictOf(
                { label: 'Knip (unused code)', log: 'knip.log', seconds: 2, status: 1 },
                read,
            ),
            passVerdictOf({ label: 'Names (tree)', log: 'names.log', seconds: 1, status: 0 }, read),
            driftPassOf(1, 0.5),
            driftPassOf(0, 0.5),
        ]).toStrictEqual([
            {
                firstError: 'knip.log: the first finding',
                label: 'Knip (unused code)',
                seconds: 2,
                status: 1,
            },
            { firstError: null, label: 'Names (tree)', seconds: 1, status: 0 },
            {
                firstError: 'the drift report refused; its report is above',
                label: 'Drift (profile)',
                seconds: 0.5,
                status: 1,
            },
            { firstError: null, label: 'Drift (profile)', seconds: 0.5, status: 0 },
        ]);
    });

    test('checkVerdictOf — names the command, red when any pass is, green over passes that all passed', () => {
        // Given - a project in no repository, its passes green, then one red
        const project = folder();
        const green = [pass('Config (one file)', 0)];
        const red = [...green, pass('Oxlint Check', 1, 'src/a.ts:1:1')];

        // Then - a green check, then a red fix
        expect([
            checkVerdictOf(project, { fix: false, passes: green }),
            checkVerdictOf(project, { fix: true, passes: red }),
        ]).toStrictEqual([
            { command: 'check', head: null, mutation: null, passes: green, status: 0 },
            { command: 'fix', head: null, mutation: null, passes: red, status: 1 },
        ]);
    });

    test('verdictLineOf — a line in green for a verdict that passed, in red for one that did not', () => {
        // Given - the same text over a green and a red status
        const lines = [0, 2].map((status) => verdictLineOf(status, 'the verdict'));

        // Then - each in its colour, ended
        expect(lines).toStrictEqual([
            '\u001B[0;32mthe verdict\u001B[0m\n',
            '\u001B[0;31mthe verdict\u001B[0m\n',
        ]);
    });
});
