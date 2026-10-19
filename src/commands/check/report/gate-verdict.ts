import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { ARTIFACTS } from '../../../../lint/kit/project/build-plan.js';
import { git } from '../../../../lint/kit/project/git.js';
import { GREEN, RED, RESET } from './terminal.js';

/** Where every gate command leaves its verdict, from the project's root. */
export const VERDICT_FILE = `${ARTIFACTS}/gate/verdict.json`;

export type PassVerdict = {
    firstError: null | string;
    label: string;
    seconds: number;
    status: number;
};

export type MutationVerdict = {
    detected: number;
    range: string;
    survivors: { file: string; line: number; mutator: string }[];
    unrun: number;
};

export type GateVerdict = {
    command: 'check' | 'fix' | 'mutation';
    head: null | string;
    mutation: MutationVerdict | null;
    passes: PassVerdict[];
    status: number;
};

// outside: a GitHub runner reads a tool's finding as a workflow command, `::error file=...,title=<rule>::<message>`, its values percent-escaped.
const WORKFLOW_COMMAND =
    /^::(?<severity>error|notice|warning)(?<properties>(?: [^:]*)?)::(?<message>.*)/u;

const unescaped = (text: string): string =>
    text.replaceAll(/%(?:0A|0D|25|2C|3A)/gu, (code) => decodeURIComponent(code));

const TITLE = /[ ,]title=(?<title>[^,]*)/u;

const LOCATED = /^(?<at>\S+:\d+:\d+): /u;

const readableOf = (line: string): string =>
    line.replace(
        WORKFLOW_COMMAND,
        (_command: string, severity: string, properties: string, message: string): string => {
            const first = unescaped(message).replace(/\r?\n[\s\S]*/u, '');
            const title = TITLE.exec(properties)?.[1];
            const said = title === undefined ? severity : `${severity} ${unescaped(title)}:`;

            return LOCATED.test(first)
                ? first.replace(LOCATED, (_first: string, at: string): string => `${at}: ${said} `)
                : `${said} ${first}`;
        },
    );

/** The first line of a log that says anything, without its colours, and a runner's workflow command read as a terminal prints it. */
export function firstFindingOf(log: string): null | string {
    const line = stripVTControlCharacters(log)
        .split('\n')
        .map((text) => text.trim())
        .find((text) => text !== '');

    return line === undefined ? null : readableOf(line);
}

/** The commit the checkout stands on, or `null` outside a repository or before its first commit. */
export const headOf = (project: string): null | string =>
    git(project, ['rev-parse', '--verify', '--quiet', 'HEAD'])?.trim() ?? null;

export function verdictWritten(project: string, verdict: GateVerdict): void {
    const file = join(project, VERDICT_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(verdict, null, 4)}\n`);
}

/** A pass's entry: its first finding read from its log where it failed. */
export const passVerdictOf = (
    {
        label,
        log,
        seconds,
        status,
    }: { label: string; log: string; seconds: number; status: number },
    read: (log: string) => string,
): PassVerdict => ({
    firstError: status === 0 ? null : firstFindingOf(read(log)),
    label,
    seconds,
    status,
});

/** The drift report's entry: its report goes to the terminal, so its finding is named by where to read it. */
export const driftPassOf = (status: number, seconds: number): PassVerdict => ({
    firstError: status === 0 ? null : 'the drift report refused; its report is above',
    label: 'Drift (profile)',
    seconds,
    status,
});

/** The verdict of a check or a fix: red when any pass is. */
export function checkVerdictOf(
    project: string,
    { fix, passes }: { fix: boolean; passes: readonly PassVerdict[] },
): GateVerdict {
    return {
        command: fix ? 'fix' : 'check',
        head: headOf(project),
        mutation: null,
        passes: [...passes],
        status: passes.every((pass) => pass.status === 0) ? 0 : 1,
    };
}

/** A verdict's line, green when it passed and red when it did not. */
export const verdictLineOf = (status: number, text: string): string =>
    `${status === 0 ? GREEN : RED}${text}${RESET}\n`;

/** The run's last line: the first failing pass and its first finding, or that every pass passed. */
export function checkSummaryOf({ passes, status }: Pick<GateVerdict, 'passes' | 'status'>): string {
    if (status === 0) {
        return '✓ All checks passed';
    }
    const failing = passes.find((pass) => pass.status !== 0);
    if (failing === undefined) {
        return '✗ Some checks failed';
    }

    return `✗ Some checks failed, first ${failing.label}${failing.firstError === null ? '' : `: ${failing.firstError}`}`;
}

/** The mutation run's last line: its own numbers, never a count Stryker printed on the way, or, for a run that judged nothing, why. */
export function mutationSummaryOf(status: number, mutation: MutationVerdict | string): string {
    if (typeof mutation === 'string') {
        return `${status === 0 ? '✓ Mutation passed' : '✗ Mutation failed'}: ${mutation}`;
    }
    const counts = `${String(mutation.detected)} detected, ${String(mutation.survivors.length)} surviving, ${String(mutation.unrun)} never judged, over ${mutation.range}`;
    const [first] = mutation.survivors;

    return status === 0
        ? `✓ Mutation passed: ${counts}`
        : `✗ Mutation failed: ${first === undefined ? '' : `first survivor ${first.file}:${String(first.line)} ${first.mutator}; `}${counts}`;
}
