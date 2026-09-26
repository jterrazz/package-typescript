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
    readRatchet,
    reRecord,
    SECTION,
    serialise,
    withSection,
} from '../baseline/ratchet.js';
import { readCommandLine } from './command-line.js';

function reportAt(path) {
    if (path === undefined) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

const print = (line) => stdout.write(`${line}\n`);

function write(root, counts, silentPass) {
    if (silentPass !== undefined) {
        print(
            `the ${silentPass.label} pass wrote no report — the ${SECTION} section is left as it was; 'typescript check' prints why`,
        );

        return 1;
    }
    const { problem } = readRatchet(root);
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
    print(`${LABEL} written — ${total} diagnostic(s) across ${Object.keys(counts).length} rule(s)`);

    return 0;
}

function unkept(linterCounts, counts, speaksHeld) {
    const rules = Object.keys(linterCounts).toSorted();
    for (const rule of rules) {
        print(`${rule}  ${linterCounts[rule]} diagnostic(s), and the project keeps no baseline`);
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

function passReportsOf(commandLine) {
    return [
        { flag: '--names', label: 'Names (tree)' },
        { flag: '--comments', label: 'Comments (density)' },
    ]
        .map(({ flag, label }) => {
            const path = commandLine.value(flag);

            return { label, path, report: reportAt(path) };
        })
        .filter(({ path }) => path !== undefined);
}

function judged(root, sections, { commandLine, counts, isHeld, linterCounts, speaksHeld }) {
    // Each pass re-records its own entries.
    let section = sections[SECTION];
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

export function baseline(args, { held }) {
    const commandLine = readCommandLine(args, ['--names', '--comments', '--linter-exit']);
    const linterExit = commandLine.value('--linter-exit');
    const [reportPath, rootArgument] = commandLine.positionals;
    const root = resolve(rootArgument ?? '.');

    const report = reportAt(reportPath);
    if (report === null) {
        print(`oxlint wrote no JSON report at ${reportPath} — the baseline cannot be read`);

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

    const { problem, sections } = readRatchet(root);
    if (problem !== null) {
        print(`baseline-unreadable  ${BASELINE}  ${problem}`);

        return 1;
    }
    if ((sections?.[SECTION] ?? null) === null) {
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
