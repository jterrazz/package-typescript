import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';

import {
    BASELINE,
    countsOf,
    diagnosticsOf,
    heldSummary,
    isHeldBy,
    isTestOwned,
    judge,
    LABEL,
    readBaseline,
    reRecord,
    SECTION,
    serialise,
    withSection,
} from '../baseline/section.js';
import type { Counts, Sections } from '../baseline/section.js';
import { readCommandLine } from './command-line.js';
import type { CommandLine } from './command-line.js';

type PassReport = { label: string; path: string; report: unknown };

function reportAt(path: string | undefined): unknown {
    if (path === undefined) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch {
        return null;
    }
}

const print = (line: string): boolean => stdout.write(`${line}\n`);

function write(root: string, counts: Counts, silentPass: PassReport | undefined): number {
    if (silentPass !== undefined) {
        print(
            `the ${silentPass.label} pass wrote no report — the ${SECTION} section is left as it was; 'typescript check' prints why`,
        );

        return 1;
    }
    const { problem } = readBaseline(root);
    if (problem !== null) {
        print(
            `${BASELINE} ${problem} — the ${SECTION} section cannot be written beside the others`,
        );

        return 1;
    }
    const path = join(root, BASELINE);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    writeFileSync(path, withSection(text, serialise(counts)));
    print(
        `${LABEL} written — ${String(total)} diagnostic(s) across ${String(Object.keys(counts).length)} rule(s)`,
    );

    return 0;
}

function unkept(linterCounts: Counts, counts: Counts, speaksHeld: boolean): number {
    const rules = Object.keys(linterCounts).toSorted();
    for (const rule of rules) {
        print(
            `${rule}  ${String(linterCounts[rule] ?? 0)} diagnostic(s), and the project keeps no baseline`,
        );
    }
    if (rules.length > 0) {
        print("Fix them, or run 'typescript baseline' to record where the project stands.");

        return 1;
    }
    if (speaksHeld && judge(counts, {}).length === 0) {
        print(heldSummary({}));
    }

    return 0;
}

function passReportsOf(commandLine: CommandLine): PassReport[] {
    return [
        { flag: '--names', label: 'Names (tree)' },
        { flag: '--comments', label: 'Comments (density)' },
    ].flatMap(({ flag, label }) => {
        const path = commandLine.value(flag);

        return path === undefined ? [] : [{ label, path, report: reportAt(path) }];
    });
}

function judged(
    root: string,
    sections: Sections,
    {
        commandLine,
        counts,
        isHeld,
        linterCounts,
        speaksHeld,
    }: {
        commandLine: CommandLine;
        counts: Counts;
        isHeld: (rule: string) => boolean;
        linterCounts: Counts;
        speaksHeld: boolean;
    },
): number {
    // Each pass re-records its own entries.
    let section = sections[SECTION] ?? {};
    if (commandLine.has('--fix')) {
        const { lines, section: recorded } = reRecord(
            root,
            linterCounts,
            (rule) => !isHeld(rule) && !isTestOwned(rule),
        );
        for (const line of lines) {
            print(line);
        }
        section = recorded;
    }

    const kept = Object.fromEntries(Object.entries(section).filter(([rule]) => !isHeld(rule)));
    const broken = judge(linterCounts, kept);
    for (const reason of broken) {
        print(`baseline-ratchet  ${LABEL}  ${reason}`);
    }
    if (broken.length > 0) {
        print("Run 'typescript baseline' to record where the project actually stands.");

        return 1;
    }
    if (speaksHeld && judge(counts, section).length === 0) {
        print(heldSummary(counts));
    }

    return 0;
}

export function baseline(args: readonly string[], { held }: { held: readonly string[] }): number {
    const commandLine = readCommandLine(args, ['--names', '--comments', '--linter-exit']);
    const linterExit = commandLine.value('--linter-exit');
    const [reportPath, rootArgument] = commandLine.positionals;
    const root = resolve(rootArgument ?? '.');

    const report = reportAt(reportPath);
    if (report === null) {
        print(`oxlint wrote no JSON report at ${String(reportPath)} — the baseline cannot be read`);

        return 1;
    }

    // A pass that wrote no report died: its side is unknown, so nothing is summed or rewritten.
    const passReports = passReportsOf(commandLine);
    const silentPass = passReports.find(({ report: written }) => written === null);
    const speaksHeld = passReports.length > 0 && silentPass === undefined;
    const counts = countsOf(report, ...passReports.map(({ report: written }) => written ?? []));
    const linterCounts = countsOf(report);

    if (commandLine.has('--write')) {
        return write(root, counts, silentPass);
    }

    // Setting test-owned findings aside must not turn a linter that failed on no diagnostic green.
    if (linterExit !== undefined && linterExit !== '0' && diagnosticsOf(report).length === 0) {
        print(`oxlint exited ${linterExit} with no diagnostic — its own output says why`);

        return 1;
    }

    const { problem, sections } = readBaseline(root);
    if (problem !== null) {
        print(`baseline-unreadable  ${BASELINE}  ${problem}`);

        return 1;
    }
    if (sections?.[SECTION] === undefined) {
        return unkept(linterCounts, counts, speaksHeld);
    }

    return judged(root, sections, {
        commandLine,
        counts,
        isHeld: (rule) => isHeldBy(held, rule),
        linterCounts,
        speaksHeld,
    });
}
