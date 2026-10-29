import { stripVTControlCharacters } from 'node:util';

import { lessonParts } from '../../../../lint/kit/catalogue/lesson.js';
import { firstFindingOf, unescaped, WORKFLOW_COMMAND } from './gate-verdict.js';

/** A finding as CI states it: its rule, its place, what was found in one sentence, then what fixes it and where to read why. */
export type CiFinding = {
    column?: number | undefined;
    fix?: string | undefined;
    found: string;
    line?: number | undefined;
    path?: string | undefined;
    read?: string | undefined;
    rule: string;
    severity: 'error' | 'warning';
};

type Severity = CiFinding['severity'];

// outside: the toolchain's own line, and oxlint's under an agent: `path:line:column: error <pass>(<rule>): <message>`.
const REPORT_LINE =
    /^(?<path>[^\s:]+):(?<line>\d+):(?<column>\d+): (?<severity>error|warning) (?<rule>\S+?\(.*?\)): (?<message>.*)$/u;

// outside: the TypeScript compiler's line, `path(line,column): error TS2322: <message>`.
const COMPILER_LINE =
    /^(?<path>[^\s(]+)\((?<line>\d+),(?<column>\d+)\): (?<severity>error|warning) (?<code>TS\d+): (?<message>.*)$/u;

// outside: knip's report, a heading per kind of issue, `Unused exports (2)`, then one issue per line ending on its place.
const KNIP_HEADING = /^(?<kind>[A-Z][a-z]+(?: [a-z]+)*) \(\d+\)$/u;

// outside: oxfmt's check names each file it would reformat, `src/a.ts (3ms)`.
const OXFMT_LINE = /^(?<path>\S+) \(\d[\d.]*m?s\)$/u;

const PLACE = /^(?<path>[^\s:]+)(?::(?<line>\d+)(?::(?<column>\d+))?)?$/u;

const numberOf = (text: string | undefined): number | undefined =>
    text === undefined ? undefined : Number(text);

function taught(message: string): Pick<CiFinding, 'fix' | 'found' | 'read'> {
    const parts = lessonParts(message);
    const found = parts?.found;
    if (found === undefined) {
        return { found: message };
    }

    return { fix: parts?.fix, found, read: parts?.read };
}

const severityOf = (text: string): Severity => (text === 'warning' ? 'warning' : 'error');

function commandFinding(line: string, pass: string): CiFinding | undefined {
    const command = WORKFLOW_COMMAND.exec(line)?.groups;
    if (command === undefined) {
        return undefined;
    }
    const properties = Object.fromEntries(
        (command.properties ?? '')
            .trim()
            .split(',')
            .map((property) => property.split('='))
            .map(([key = '', ...value]) => [key, unescaped(value.join('='))]),
    );
    // outside: oxlint opens its message on the place the properties already state, `shapes.ts:2:23: `.
    const message = (unescaped(command.message ?? '').split(/\r?\n/u)[0] ?? '').replace(
        /^\S+:\d+:\d+: /u,
        '',
    );

    return {
        column: numberOf(properties.col),
        ...taught(message),
        line: numberOf(properties.line),
        path: properties.file,
        rule: properties.title ?? pass,
        severity: severityOf(command.severity ?? ''),
    };
}

function lineFinding(line: string, pass: string): CiFinding | undefined {
    const reported = REPORT_LINE.exec(line)?.groups ?? COMPILER_LINE.exec(line)?.groups;
    if (reported !== undefined) {
        return {
            column: numberOf(reported.column),
            ...taught(reported.message ?? ''),
            line: numberOf(reported.line),
            path: reported.path,
            rule: reported.rule ?? `typescript(${reported.code ?? ''})`,
            severity: severityOf(reported.severity ?? ''),
        };
    }
    if (line.startsWith('found: ')) {
        return { ...taught(line), rule: pass, severity: 'error' };
    }

    return commandFinding(line, pass);
}

const kebab = (text: string): string => text.toLowerCase().replaceAll(' ', '-');

function knipFindings(lines: readonly string[]): CiFinding[] {
    const findings: CiFinding[] = [];
    let kind: string | undefined;
    for (const line of lines) {
        const heading = KNIP_HEADING.exec(line)?.groups?.kind;
        if (heading !== undefined) {
            kind = heading;
            continue;
        }
        const words = line.split(' ');
        const place = PLACE.exec(words.at(-1) ?? '')?.groups;
        if (kind === undefined || place === undefined) {
            kind = undefined;
            continue;
        }
        findings.push({
            column: numberOf(place.column),
            found: `${kind}: ${words[0] ?? ''}`,
            line: numberOf(place.line),
            path: place.path,
            rule: `knip(${kebab(kind)})`,
            severity: 'error',
        });
    }

    return findings;
}

function oxfmtFindings(lines: readonly string[]): CiFinding[] {
    return lines.flatMap((line) => {
        const path = OXFMT_LINE.exec(line)?.groups?.path;

        return path === undefined
            ? []
            : [
                  {
                      fix: 'run `typescript fix`, which formats it',
                      found: `${path} is not formatted`,
                      path,
                      read: 'docs/reference/quality-checks.md#the-oxfmt-pass',
                      rule: 'oxfmt(format)',
                      severity: 'error' as const,
                  },
              ];
    });
}

/** Every finding a pass's log states, read from the forms its tools print; a failing pass whose log states none is one finding, its first line. */
export function ciFindingsOf({
    log,
    pass,
    status,
}: {
    log: string;
    pass: string;
    status: number;
}): CiFinding[] {
    const lines = stripVTControlCharacters(log)
        .split('\n')
        .map((line) => line.trim());
    const read = [
        ...lines.flatMap((line) => lineFinding(line, pass) ?? []),
        ...(pass === 'unused' ? knipFindings(lines) : []),
        ...(pass === 'format' ? oxfmtFindings(lines) : []),
    ];
    if (read.length > 0 || status === 0) {
        return read;
    }

    return [
        {
            found: firstFindingOf(log) ?? `the pass failed with exit code ${String(status)}`,
            rule: pass,
            severity: 'error',
        },
    ];
}
