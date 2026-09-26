#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import {
    BASELINE,
    countsOf,
    diagnosticsOf,
    heldSummary,
    isPassOwned,
    isTestOwned,
    judge,
    LABEL,
    readRatchet,
    reRecord,
    SECTION,
    serialise,
    withSection,
} from './baseline.js';

function flagValue(flag) {
    const index = argv.indexOf(flag);

    return index === -1 ? undefined : argv[index + 1];
}

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

const isWrite = argv.includes('--write');
const isFix = argv.includes('--fix');
const namesPath = flagValue('--names');
const commentsPath = flagValue('--comments');
const linterExit = flagValue('--linter-exit');
const flagValues = new Set(
    [namesPath, commentsPath, linterExit].filter((value) => value !== undefined),
);
const positional = argv
    .slice(2)
    .filter((argument) => !argument.startsWith('--') && !flagValues.has(argument));
const reportPath = positional[0];
const root = resolve(positional[1] ?? '.');

let report;
try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
    stdout.write(`oxlint wrote no JSON report at ${reportPath} — the baseline cannot be read\n`);
    exit(1);
}

// A pass that wrote no report died: its side is unknown, so nothing is summed or rewritten.
const passReports = [
    { label: 'Names (tree)', path: namesPath, report: reportAt(namesPath) },
    { label: 'Comments (density)', path: commentsPath, report: reportAt(commentsPath) },
].filter(({ path }) => path !== undefined);
const silentPass = passReports.find(({ report: written }) => written === null);
const speaksHeld = passReports.length > 0 && silentPass === undefined;

const counts = countsOf(report, ...passReports.map(({ report: written }) => written ?? []));
const linterCounts = countsOf(report);

if (isWrite) {
    if (silentPass !== undefined) {
        stdout.write(
            `the ${silentPass.label} pass wrote no report — the ${SECTION} section is left as it was; 'typescript check' prints why\n`,
        );
        exit(1);
    }
    const { problem } = readRatchet(root);
    if (problem !== null) {
        stdout.write(
            `${BASELINE} ${problem} — the ${SECTION} section cannot be written beside the others\n`,
        );
        exit(1);
    }
    const path = join(root, BASELINE);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    writeFileSync(path, withSection(text, serialise(counts)));
    stdout.write(
        `${LABEL} written — ${total} diagnostic(s) across ${Object.keys(counts).length} rule(s)\n`,
    );
    exit(0);
}

// Setting test-owned findings aside must not turn a linter that failed on no diagnostic green.
if (linterExit !== undefined && linterExit !== '0' && diagnosticsOf(report).length === 0) {
    stdout.write(`oxlint exited ${linterExit} with no diagnostic — its own output says why\n`);
    exit(1);
}

const { problem, sections } = readRatchet(root);
if (problem !== null) {
    stdout.write(`baseline-unreadable  ${BASELINE}  ${problem}\n`);
    exit(1);
}

const whole = sections?.[SECTION] ?? null;

if (whole === null) {
    const rules = Object.keys(linterCounts).toSorted();
    for (const rule of rules) {
        stdout.write(
            `${rule}  ${linterCounts[rule]} diagnostic(s), and the project keeps no baseline\n`,
        );
    }
    if (rules.length > 0) {
        stdout.write(
            "Fix them, or run 'typescript baseline' to record where the project stands.\n",
        );
    }
    if (rules.length > 0) {
        exit(1);
    }
    if (speaksHeld && judge(counts, {}).length === 0) {
        stdout.write(`${heldSummary({})}\n`);
    }
    exit(0);
}

// Each pass re-records its own entries.
let section = whole;
if (isFix) {
    const { lines, section: recorded } = reRecord(
        root,
        linterCounts,
        (rule) => !isPassOwned(rule) && !isTestOwned(rule),
    );
    for (const line of lines) {
        stdout.write(`${line}\n`);
    }
    section = recorded;
}

const baseline = Object.fromEntries(Object.entries(section).filter(([rule]) => !isPassOwned(rule)));
const broken = judge(linterCounts, baseline);

for (const reason of broken) {
    stdout.write(`baseline-ratchet  ${LABEL}  ${reason}\n`);
}
if (broken.length > 0) {
    stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
    exit(1);
}
if (speaksHeld && judge(counts, section).length === 0) {
    stdout.write(`${heldSummary(counts)}\n`);
}

exit(0);
