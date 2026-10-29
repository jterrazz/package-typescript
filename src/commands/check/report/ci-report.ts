import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import { GREEN, print, RED, RESET, secondsOf } from '../../terminal.js';
import { ciFindingsOf } from './ci-finding.js';
import type { CiFinding } from './ci-finding.js';
import type { Logs } from './logs.js';
import { annotationOf, groupOf, workspacePathOf } from './workflow-commands.js';

/** A pass as CI lists it: its short name, its result, and its seconds or the proof it was answered from. */
export type CiRow = { findings: readonly CiFinding[]; name: string; status: number; time: string };

/** How many findings the step summary lists before it counts the rest. */
export const SUMMARY_CAP = 20;

const NAME_WIDTH = 14;

const SHORT_NAMES: Readonly<Record<string, string>> = {
    'Knip (unused code)': 'unused',
    'Oxfmt Check': 'format',
    'Oxfmt Format': 'format',
    'Oxlint Check': 'lint',
    'Oxlint Fix': 'lint',
    'TypeScript Check': 'types',
};

/** A pass's short name, `Config (one file)` read `config`: the word a CI line is scanned by. */
export const passNameOf = (label: string): string =>
    SHORT_NAMES[label] ?? label.replace(/ .*/u, '').toLowerCase();

const plural = (count: number, word: string): string =>
    `${String(count)} ${word}${count === 1 ? '' : word.endsWith('s') ? 'es' : 's'}`;

/** A pass's result: `✓`, or `✗` and how many findings it failed on. */
export const resultOf = ({ findings, status }: Pick<CiRow, 'findings' | 'status'>): string =>
    status === 0 ? '✓' : `✗ ${plural(findings.length, 'error')}`;

/** One aligned line per pass: `config        ✗ 1 error · 0.2s`, `types         ✓ 3.1s`. */
export function passLineOf(row: CiRow): string {
    const result = resultOf(row);

    return `${row.name.padEnd(NAME_WIDTH)}${result}${row.status === 0 ? ' ' : ' · '}${row.time}`;
}

const placeOf = (finding: CiFinding, path: string): string =>
    `${path}:${String(finding.line ?? 1)}:${String(finding.column ?? 1)}`;

type Place = (path: string) => string;

/** A finding over several lines: its rule and place, what was found, then `fix` and `read`; the why stays in the pass's fold. */
export function errorBlockOf(finding: CiFinding, place: Place): string {
    const where = finding.path === undefined ? '' : `  ${placeOf(finding, place(finding.path))}`;
    const lines = [
        `${finding.severity} ${finding.rule}${where}`,
        `  ${finding.found}`,
        ...(finding.fix === undefined ? [] : [`  fix   ${finding.fix}`]),
        ...(finding.read === undefined ? [] : [`  read  ${finding.read}`]),
    ];

    return `${lines.join('\n')}\n`;
}

/** The annotation a finding owes, its path read from the workspace. */
export const ciAnnotationOf = (finding: CiFinding, place: Place): string =>
    annotationOf({
        column: finding.column,
        line: finding.line,
        message: finding.found,
        path: finding.path === undefined ? undefined : place(finding.path),
        severity: finding.severity,
        title: finding.rule,
    });

const cell = (text: string): string => text.replaceAll('|', String.raw`\|`);

/** The step summary: a table of the passes, then the findings, the first `SUMMARY_CAP` listed and the rest counted. */
export function stepSummaryOf(
    command: string,
    rows: readonly CiRow[],
    place: Place,
    cap = SUMMARY_CAP,
): string {
    const findings = rows.flatMap((row) => row.findings);
    const table = [
        `### typescript ${command}`,
        '',
        '| Pass | Result | Time |',
        '| --- | --- | --- |',
        ...rows.map((row) => `| ${row.name} | ${cell(resultOf(row))} | ${cell(row.time)} |`),
        '',
    ];
    const listed = findings
        .slice(0, cap)
        .map(
            (finding) =>
                `- \`${finding.rule}\`${finding.path === undefined ? '' : ` \`${placeOf(finding, place(finding.path))}\``}: ${finding.found}`,
        );
    const more = findings.length > cap ? [`- … and ${String(findings.length - cap)} more`] : [];
    const errors = findings.length === 0 ? [] : ['**Findings**', '', ...listed, ...more, ''];

    return `${[...table, ...errors].join('\n')}\n`;
}

/** The run's last line on CI: how many passes ran, and which failed. */
export function conclusionOf(rows: readonly CiRow[]): string {
    const failed = rows.filter((row) => row.status !== 0).map((row) => row.name);
    const ran = plural(rows.length, 'pass');

    return failed.length === 0
        ? `${GREEN}✓ ${ran}, all green${RESET}\n`
        : `${RED}✗ ${ran}, ${String(failed.length)} failed: ${failed.join(', ')}${RESET}\n`;
}

/** A pass as CI prints it: its line, as the title of a fold that holds its raw log when it printed one. */
export function ciPassPrinted(
    logs: Logs,
    {
        label,
        log,
        seconds,
        status,
        writes = false,
    }: { label: string; log: string; seconds: number; status: number; writes?: boolean },
): CiRow {
    const name = passNameOf(label);
    const text = logs.read(log);
    const row = {
        findings: ciFindingsOf({ log: text, pass: name, status }),
        name,
        status,
        time: secondsOf(seconds),
    };
    const shown = (status !== 0 || writes) && text !== '';
    print(shown ? groupOf(passLineOf(row), text, randomUUID()) : `${passLineOf(row)}\n`);

    return row;
}

/** The drift report's line, printed after the fold its report went to; a refusal is one finding, its first line. */
export function ciDriftPrinted({
    firstError,
    seconds,
    status,
}: {
    firstError: null | string;
    seconds: number;
    status: number;
}): CiRow {
    const found =
        firstError === null
            ? []
            : [{ found: firstError, rule: 'drift', severity: 'error' as const }];
    const row = { findings: found, name: 'drift', status, time: secondsOf(seconds) };
    print(`${passLineOf(row)}\n`);

    return row;
}

/** Where a CI run's paths and summary go: the workspace the paths are read from, and the step summary file, each where GitHub names one. */
export type CiPlace = {
    project: string;
    summary: string | undefined;
    workspace: string | undefined;
};

export const ciPlaceOf = (project: string, environment: NodeJS.ProcessEnv): CiPlace => ({
    project,
    summary: environment.GITHUB_STEP_SUMMARY,
    workspace: environment.GITHUB_WORKSPACE,
});

/** The end of a CI run: each finding over its lines, an annotation each, the step summary appended, and the last line. */
export function ciConcluded(command: string, rows: readonly CiRow[], where: CiPlace): void {
    const place: Place = (path) => workspacePathOf(path, where.project, where.workspace);
    const findings = rows.flatMap((row) => row.findings);
    if (findings.length > 0) {
        print(`\n${findings.map((finding) => errorBlockOf(finding, place)).join('\n')}\n`);
        print(
            findings
                .map((finding) => ciAnnotationOf(finding, place))
                .map((line) => `${line}\n`)
                .join(''),
        );
    }
    if (where.summary !== undefined && where.summary !== '') {
        appendFileSync(where.summary, stepSummaryOf(command, rows, place));
    }
    print(conclusionOf(rows));
}
