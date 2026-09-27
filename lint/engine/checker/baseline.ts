import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';

import { reportedCounts } from '../baseline/counts.js';
import {
    BASELINE,
    isHeldBy,
    LABEL,
    readBaseline,
    SECTION,
    serialise,
    withSection,
} from '../baseline/section.js';
import type { Counts } from '../baseline/section.js';
import { refusal } from '../catalogue/lesson.js';
import { readCommandLine } from './command-line.js';
import type { CommandLine } from './command-line.js';

type PassReport = { label: string; report: unknown };

function reportAt(path: string): unknown {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch {
        return null;
    }
}

const print = (line: string): boolean => stdout.write(`${line}\n`);

function passReportsOf(commandLine: CommandLine): PassReport[] {
    return [
        { flag: '--architecture', label: 'Architecture (layer map)' },
        { flag: '--names', label: 'Names (tree)' },
        { flag: '--comments', label: 'Comments (density)' },
    ].flatMap(({ flag, label }) => {
        const path = commandLine.value(flag);

        return path === undefined ? [] : [{ label, report: reportAt(path) }];
    });
}

function write(root: string, reports: readonly PassReport[]): number {
    const silent = reports.find(({ report }) => report === null);
    if (silent !== undefined) {
        print(
            refusal({
                fix: "run 'typescript check', which prints why the pass could not judge the tree, correct that, then run 'typescript baseline' again",
                found: `the ${silent.label} pass wrote no report, so the ${SECTION} section is left as it was`,
                read: 'docs/06-quality-checks.md#recording-it',
                why: "a section written without that pass's counts would erase its debt rather than record it",
            }),
        );

        return 1;
    }
    const { problem } = readBaseline(root);
    if (problem !== null) {
        print(
            refusal({
                fix: `correct ${BASELINE} until it is one JSON object of sections, or delete it, then run again`,
                found: `${BASELINE} ${problem}`,
                read: 'docs/06-quality-checks.md#recording-it',
                why: `the ${SECTION} section is written beside the others, and a file that cannot be read as sections would lose them`,
            }),
        );

        return 1;
    }
    const counts: Counts = reportedCounts(...reports.map(({ report }) => report));
    const path = join(root, BASELINE);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    writeFileSync(path, withSection(text, serialise(counts)));
    print(
        `${LABEL} written — ${String(total)} finding(s) across ${String(Object.keys(counts).length)} rule(s)`,
    );

    return 0;
}

function oxlintRulesLeftInTheSection(root: string, held: readonly string[]): number {
    const { problem, sections } = readBaseline(root);
    if (problem !== null) {
        print(
            `baseline-unreadable  ${BASELINE}  ${refusal({
                fix: `correct ${BASELINE} until it is one JSON object of sections, or delete it and run 'typescript baseline'`,
                found: `${BASELINE} ${problem}`,
                read: 'docs/06-quality-checks.md#the-ratchet',
                why: 'the ratchet reads its counts from that file, and a file it cannot read holds no debt it can judge',
            })}`,
        );

        return 1;
    }
    const stray = Object.keys(sections?.[SECTION] ?? {})
        .filter((rule) => !isHeldBy(held, rule))
        .toSorted();
    for (const rule of stray) {
        print(
            `baseline-moved-to-oxlint  ${LABEL}  ${refusal({
                fix: "run 'typescript baseline', which records the lint debt in oxlint-suppressions.json and drops the entry",
                found: `\`${rule}\` is an oxlint rule, and the section holds its count`,
                read: 'docs/06-quality-checks.md#the-ratchet',
                why: 'oxlint holds its own rules in oxlint-suppressions.json, file by file, so the section holds only the passes of this toolchain',
            })}`,
        );
    }

    return stray.length > 0 ? 1 : 0;
}

export function baseline(args: readonly string[], { held }: { held: readonly string[] }): number {
    const commandLine = readCommandLine(args, ['--architecture', '--names', '--comments']);
    const root = resolve(commandLine.positionals[0] ?? '.');

    return commandLine.has('--write')
        ? write(root, passReportsOf(commandLine))
        : oxlintRulesLeftInTheSection(root, held);
}
