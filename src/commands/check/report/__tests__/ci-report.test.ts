import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import type { CiFinding } from '../ci-finding.js';
import {
    ciConcluded,
    ciDriftPrinted,
    ciPassPrinted,
    ciPlaceOf,
    conclusionOf,
    errorBlockOf,
    passLineOf,
    passNameOf,
    stepSummaryOf,
} from '../ci-report.js';
import type { CiRow } from '../ci-report.js';
import { logsIn } from '../logs.js';

const FOUND: CiFinding = {
    column: 7,
    fix: 'add it',
    found: 'the file is missing',
    line: 3,
    path: 'src/a.ts',
    read: 'docs/reference/quality-checks.md#a',
    rule: 'config(project-declared)',
    severity: 'error',
};

const same = (path: string): string => path;

const place = (path: string): string => `packages/api/${path}`;

const red = (name: string): CiRow => ({ findings: [], name, status: 1, time: '1s' });

function folder(): string {
    const made = mkdtempSync(join(tmpdir(), 'ci-report-'));
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

function printed(work: () => void): string {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    work();
    const text = write.mock.calls.map(([chunk]) => String(chunk)).join('');
    vi.restoreAllMocks();

    return text;
}

describe('ci-report', () => {
    test("passNameOf — the word a CI line is scanned by, a tool's label read as what it judges", () => {
        // Given - the labels of the tool passes and of the toolchain's own
        // Then - the four tool labels, then the first word of every other label
        expect(
            [
                'TypeScript Check',
                'Oxlint Check',
                'Oxlint Fix',
                'Oxfmt Check',
                'Oxfmt Format',
                'Knip (unused code)',
                'Config (one file)',
                'Names (tree)',
                'Secrets',
            ].map((label) => passNameOf(label)),
        ).toStrictEqual([
            'types',
            'lint',
            'lint',
            'format',
            'format',
            'unused',
            'config',
            'names',
            'secrets',
        ]);
    });

    test('passLineOf — one aligned line: the name, the mark and its count, then the seconds or the proof', () => {
        // Given - a green pass, a red one, and a red one of several findings
        // Then - a green line, a red one and a red one of several findings, each name padded to one column
        expect(
            [
                { findings: [], name: 'types', status: 0, time: '3.1s' },
                { findings: [FOUND], name: 'config', status: 1, time: '0.2s' },
                { findings: [FOUND, FOUND], name: 'architecture', status: 1, time: '1.0s' },
            ].map((row) => passLineOf(row)),
        ).toStrictEqual([
            'types         ✓ 3.1s',
            'config        ✗ 1 error · 0.2s',
            'architecture  ✗ 2 errors · 1.0s',
        ]);
    });

    test('errorBlockOf — the rule and place, the finding, then fix and read, each part a finding lacks left out', () => {
        // Given - a full finding, and a place-less one with no fix nor read

        // Then - the place read from the workspace, and nothing of what the second lacks
        expect(errorBlockOf(FOUND, place)).toBe(
            [
                'error config(project-declared)  packages/api/src/a.ts:3:7',
                '  the file is missing',
                '  fix   add it',
                '  read  docs/reference/quality-checks.md#a',
                '',
            ].join('\n'),
        );
        expect(
            errorBlockOf(
                { found: 'the report refused', rule: 'drift', severity: 'warning' },
                place,
            ),
        ).toBe('warning drift\n  the report refused\n');
        expect(errorBlockOf({ found: 'f', path: 'b.ts', rule: 'r', severity: 'error' }, same)).toBe(
            'error r  b.ts:1:1\n  f\n',
        );
    });

    test('stepSummaryOf — the table of passes, then the findings, the first listed up to the cap and the rest counted', () => {
        // Given - a green pass, a cached one with a pipe in its time, and a red one of three findings
        const rows: CiRow[] = [
            { findings: [], name: 'types', status: 0, time: '3.1s' },
            { findings: [], name: 'lint', status: 0, time: 'cached | x' },
            {
                findings: [FOUND, { ...FOUND, path: undefined }, { ...FOUND, found: 'third' }],
                name: 'config',
                status: 1,
                time: '0.2s',
            },
        ];

        // Then - the cap of two lists two findings and counts the third
        expect(stepSummaryOf('check', rows, same, 2)).toBe(
            [
                '### typescript check',
                '',
                '| Pass | Result | Time |',
                '| --- | --- | --- |',
                '| types | ✓ | 3.1s |',
                String.raw`| lint | ✓ | cached \| x |`,
                '| config | ✗ 3 errors | 0.2s |',
                '',
                '**Findings**',
                '',
                '- `config(project-declared)` `src/a.ts:3:7`: the file is missing',
                '- `config(project-declared)`: the file is missing',
                '- … and 1 more',
                '',
                '',
            ].join('\n'),
        );
    });

    test('stepSummaryOf — every finding under the cap is listed with no count, and a green run is its table alone', () => {
        // Given - a red pass of twenty findings, and a green run
        // Then - twenty findings fit the default cap, and no findings means no list
        const twenty = Array.from({ length: 20 }, () => FOUND);
        const summary = stepSummaryOf(
            'fix',
            [{ findings: twenty, name: 'config', status: 1, time: '1s' }],
            same,
        );
        expect(summary.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(20);
        expect(summary).not.toContain('more');
        expect(
            stepSummaryOf('check', [{ findings: [], name: 'types', status: 0, time: '1s' }], same),
        ).toBe(
            '### typescript check\n\n| Pass | Result | Time |\n| --- | --- | --- |\n| types | ✓ | 1s |\n\n',
        );
    });

    test('conclusionOf — how many passes ran, and the names of those that failed', () => {
        // Given - a green pass, and two red ones
        const green = { findings: [], name: 'types', status: 0, time: '1s' };
        // Then - green when none failed, red naming each that did
        expect(conclusionOf([green])).toBe('\u001B[0;32m✓ 1 pass, all green\u001B[0m\n');
        expect(conclusionOf([green, red('lint'), red('config')])).toBe(
            '\u001B[0;31m✗ 3 passes, 2 failed: lint, config\u001B[0m\n',
        );
    });

    test('ciPassPrinted — a failing pass is its line titling a fold of its raw log; a green one its line alone', () => {
        // Given - the logs of a failing pass, of a green one, of a green one that wrote, and of a silent failing one
        const logs = logsIn(folder());
        writeFileSync(logs.at('config.log'), `src/a.ts:3:7: error config(project-declared): f\n`);
        writeFileSync(logs.at('chatter.log'), 'chatter\n');
        writeFileSync(logs.at('silent.log'), '');

        // When - each is printed
        const rows: CiRow[] = [];
        const text = printed(() => {
            rows.push(
                ciPassPrinted(logs, {
                    label: 'Config (one file)',
                    log: logs.at('config.log'),
                    seconds: 0.2,
                    status: 1,
                }),
                ciPassPrinted(logs, {
                    label: 'TypeScript Check',
                    log: logs.at('chatter.log'),
                    seconds: 3.14,
                    status: 0,
                }),
                ciPassPrinted(logs, {
                    label: 'Gitignore (artefacts)',
                    log: logs.at('chatter.log'),
                    seconds: 1,
                    status: 0,
                    writes: true,
                }),
                ciPassPrinted(logs, {
                    label: 'Docs (layout)',
                    log: logs.at('silent.log'),
                    seconds: 1,
                    status: 1,
                }),
            );
        });

        // Then - the fold holds the raw log with commands stopped, the green pass is one line, the writing one folds what it wrote
        expect(text.replaceAll(/[\da-f]{8}-[\da-f-]{27}/gu, '<token>')).toBe(
            [
                '::group::config        ✗ 1 error · 0.2s',
                '::stop-commands::<token>',
                'src/a.ts:3:7: error config(project-declared): f',
                '::<token>::',
                '::endgroup::',
                'types         ✓ 3.1s',
                '::group::gitignore     ✓ 1.0s',
                '::stop-commands::<token>',
                'chatter',
                '::<token>::',
                '::endgroup::',
                'docs          ✗ 1 error · 1.0s',
                '',
            ].join('\n'),
        );
        expect(rows.map((row) => row.findings.map((finding) => finding.rule))).toStrictEqual([
            ['config(project-declared)'],
            [],
            [],
            ['docs'],
        ]);
    });

    test("ciDriftPrinted — the drift report's line, its refusal one finding", () => {
        // Given - a green drift report and a refusing one
        const rows: CiRow[] = [];

        // When - both are printed
        const text = printed(() => {
            rows.push(
                ciDriftPrinted({ firstError: null, seconds: 0.4, status: 0 }),
                ciDriftPrinted({ firstError: 'the report refused', seconds: 1, status: 1 }),
            );
        });

        // Then - two lines, and the refusal is the red one's finding
        expect(text).toBe('drift         ✓ 0.4s\ndrift         ✗ 1 error · 1.0s\n');
        expect(rows.map((row) => row.findings)).toStrictEqual([
            [],
            [{ found: 'the report refused', rule: 'drift', severity: 'error' }],
        ]);
    });

    test('ciConcluded — every finding over its lines, then its annotation from the workspace, the summary appended, then the last line', () => {
        // Given - a step summary already holding an earlier step's, and a red run of two findings in a member
        const summary = join(folder(), 'summary.md');
        writeFileSync(summary, 'earlier\n');
        const warned: CiFinding = { found: 'g', rule: 'lint', severity: 'warning' };
        const rows: CiRow[] = [
            { findings: [FOUND, warned], name: 'config', status: 1, time: '0.2s' },
        ];

        // When - the run concludes
        const text = printed(() => {
            ciConcluded(
                'check',
                rows,
                ciPlaceOf('/w/packages/api', {
                    GITHUB_STEP_SUMMARY: summary,
                    GITHUB_WORKSPACE: '/w',
                }),
            );
        });

        // Then - the block, the annotation from the workspace root, the last line, and the summary appended
        expect(text).toBe(
            [
                '',
                'error config(project-declared)  packages/api/src/a.ts:3:7',
                '  the file is missing',
                '  fix   add it',
                '  read  docs/reference/quality-checks.md#a',
                '',
                'warning lint',
                '  g',
                '',
                '::error file=packages/api/src/a.ts,line=3,col=7,title=config(project-declared)::the file is missing',
                '::warning title=lint::g',
                '\u001B[0;31m✗ 1 pass, 1 failed: config\u001B[0m',
                '',
            ].join('\n'),
        );
        expect(readFileSync(summary, 'utf8')).toBe(
            `earlier\n${stepSummaryOf('check', rows, place)}`,
        );
    });

    test('ciConcluded — a green run prints its last line alone, and writes no summary where GitHub names none', () => {
        // Given - a green run
        const rows: CiRow[] = [{ findings: [], name: 'types', status: 0, time: '1s' }];

        // When - it concludes with the variable unset, then empty
        const texts = [undefined, ''].map((summary) =>
            printed(() => {
                ciConcluded('check', rows, { project: '/p', summary, workspace: undefined });
            }),
        );

        // Then - the last line alone, both times
        expect(texts).toStrictEqual(
            Array.from({ length: 2 }, () => '\u001B[0;32m✓ 1 pass, all green\u001B[0m\n'),
        );
    });
});
