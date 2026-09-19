#!/usr/bin/env node

/**
 * The migration ratchet: a count per rule that may fall and never rise.
 *
 * A project adopting a stricter rulebook has two honest options — burn every
 * diagnostic down before the first green run, or record where it stands and
 * refuse to go backwards. `oxlint.baseline.json` is the second: `{ "<rule>":
 * <count> }`, tracked, and read by the oxlint pass instead of the raw exit
 * code. Without the file a single diagnostic fails, exactly as before.
 *
 * Three things fail a run that has one:
 *
 * - a rule whose count EXCEEDS its entry — the debt grew;
 * - a rule with diagnostics and NO entry — a rule nobody recorded owing;
 * - an entry whose count is now zero — the ratchet moved, so the entry goes.
 *
 * The third is what makes the file shrink. Without it a baseline records a debt
 * that was paid years ago and nothing ever says so.
 *
 * One file, two reporters. `@jterrazz/test`'s conventions checker judges the
 * same tree from the other side — how a spec is written rather than what the
 * code does — and a project adopting a stricter version of THAT rulebook needs
 * the same ratchet for the same reason. Its `--format json` diagnostics are
 * merged before the counting, under keys its own `jterrazz-check(<id>)` codes
 * namespace (`jterrazz-check/<id>`), so one flat file records both and neither
 * reporter can be recorded twice. Severity is not read: a finding a release
 * ships at `warn` is exactly the debt a ratchet exists to hold down.
 *
 * Usage: node check-baseline.js <oxlint-json> [root] [--checker <json>] [--write]
 *
 * `--write` rewrites the file from the current counts — that is `typescript
 * baseline`, a command of its own because it RECORDS rather than checks or
 * repairs. Exit code: 0 when the ratchet holds, 1 otherwise.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The file, at the project root, tracked beside the config it ratchets. */
export const BASELINE = 'oxlint.baseline.json';

/** `eslint(no-debugger)` is how oxlint's JSON spells `eslint/no-debugger`. */
function ruleOf(code) {
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null ? (code ?? 'unknown') : `${match.groups.plugin}/${match.groups.rule}`;
}

/**
 * The diagnostics a report carries, whichever reporter wrote it. oxlint hands
 * back an object with a `diagnostics` array; the conventions checker's
 * `--format json` is read in both shapes it may take, so the merge does not
 * depend on one of them staying fixed.
 */
export function diagnosticsOf(report) {
    if (Array.isArray(report)) {
        return report;
    }

    return Array.isArray(report?.diagnostics) ? report.diagnostics : [];
}

/** How many diagnostics each rule accounts for, across every report given. */
export function countsOf(...reports) {
    const counts = {};
    for (const report of reports) {
        for (const diagnostic of diagnosticsOf(report)) {
            const rule = ruleOf(diagnostic.code);
            counts[rule] = (counts[rule] ?? 0) + 1;
        }
    }

    return counts;
}

/** The recorded counts, or null when the project does not keep a baseline. */
export function readBaseline(root) {
    const path = join(root, BASELINE);
    if (!existsSync(path)) {
        return null;
    }

    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return {};
    }
}

/** Every way the counts break the ratchet, in the order a reader wants them. */
export function judge(counts, baseline) {
    const broken = [];

    for (const [rule, count] of Object.entries(counts).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        const allowed = baseline[rule];
        if (allowed === undefined) {
            broken.push(`${rule} has ${count} diagnostic(s) and no entry — it is new debt`);
        } else if (count > allowed) {
            broken.push(`${rule} is at ${count}, above its baseline of ${allowed}`);
        }
    }

    for (const rule of Object.keys(baseline).toSorted()) {
        if ((counts[rule] ?? 0) === 0) {
            broken.push(`${rule} is at zero — the ratchet moved, delete its entry`);
        }
    }

    return broken;
}

/** The file's text: sorted, two-space, so a diff reads as a burn-down. */
function serialise(counts) {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([left], [right]) => (left < right ? -1 : 1)),
    );

    return `${JSON.stringify(sorted, null, 2)}\n`;
}

/* Imported for the ratchet's reading, run for the gate — never both at once. */
if (import.meta.main) {
    const isWrite = argv.includes('--write');
    const checkerAt = argv.indexOf('--checker');
    const positional = argv
        .slice(2)
        .filter((argument, index) => !argument.startsWith('--') && index + 2 !== checkerAt + 1);
    const reportPath = positional[0];
    const root = resolve(positional[1] ?? '.');

    let report;
    try {
        report = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
        stdout.write(
            `oxlint wrote no JSON report at ${reportPath} — the baseline cannot be read\n`,
        );
        exit(1);
    }

    /*
     * The checker's report is optional and its absence is not a failure: the
     * flag is passed only where the installed @jterrazz/test answers
     * `--format json`, and a project on an older one keeps an oxlint-only file.
     */
    const checkerIndex = argv.indexOf('--checker');
    let checkerReport = [];
    if (checkerIndex !== -1 && argv[checkerIndex + 1] !== undefined) {
        try {
            checkerReport = JSON.parse(readFileSync(argv[checkerIndex + 1], 'utf8'));
        } catch {
            stdout.write(
                `the conventions checker wrote no JSON report at ${argv[checkerIndex + 1]} — the baseline cannot be read\n`,
            );
            exit(1);
        }
    }

    const counts = countsOf(report, checkerReport);

    if (isWrite) {
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        writeFileSync(join(root, BASELINE), serialise(counts));
        stdout.write(
            `${BASELINE} written — ${total} diagnostic(s) across ${Object.keys(counts).length} rule(s)\n`,
        );
        exit(0);
    }

    const baseline = readBaseline(root);

    if (baseline === null) {
        const rules = Object.keys(counts).toSorted();
        for (const rule of rules) {
            stdout.write(
                `${rule}  ${counts[rule]} diagnostic(s), and the project keeps no baseline\n`,
            );
        }
        if (rules.length > 0) {
            stdout.write(
                "Fix them, or run 'typescript baseline' to record where the project stands.\n",
            );
        }
        exit(rules.length > 0 ? 1 : 0);
    }

    const broken = judge(counts, baseline);

    for (const reason of broken) {
        stdout.write(`baseline-ratchet  ${BASELINE}  ${reason}\n`);
    }
    if (broken.length > 0) {
        stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
    }

    exit(broken.length > 0 ? 1 : 0);
}
