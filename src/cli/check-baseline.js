#!/usr/bin/env node

/**
 * The migration ratchet: a count per rule that may fall and never rise.
 *
 * A project adopting a stricter rulebook has two honest options — burn every
 * diagnostic down before the first green run, or record where it stands and
 * refuse to go backwards. `typescript.baseline.json` is the second: `{
 * "<rule>": <count> }`, tracked, and read by the oxlint pass instead of the raw
 * exit code. Without the file every diagnostic this package owns is a failure.
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
 * The file holds this package's rules and nothing else. oxlint's JSON report
 * also carries the `jterrazz(*)` rules a consumer composes in from
 * `@jterrazz/test`'s `testing` fragment; those, and the conventions checker's
 * `jterrazz-check/*` findings, are `test.baseline.json`'s — that package
 * records and judges them. So a diagnostic whose plugin is `jterrazz` is set
 * aside before the counting, and an entry under either of that package's
 * namespaces in THIS file is refused as misplaced: one finding, one file, one
 * judge.
 *
 * A second reporter is recorded here and judged elsewhere: the Names (tree)
 * pass's findings enter the file under `names/<rule>` when `--names <json>`
 * is given to `--write`, and that pass reads its own entries back. So a
 * judging run sets every `names/*` entry aside — this is not the judge of it.
 *
 * A green run speaks once about the file, never about a held finding: given
 * `--names <json>` beside a judging run, it prints one line for the WHOLE file
 * — `typescript.baseline.json: <n> held across <k> rules`, the shape
 * `@jterrazz/test` gives `test.baseline.json` — when both reporters' counts
 * sit within it. Where either side breaks the ratchet it prints no summary:
 * the pass that owns the broken entry prints the evidence.
 *
 * Usage: node check-baseline.js <oxlint-json> [root] [--names <json>] [--write]
 *                               [--linter-exit <code>]
 *
 * `--write` rewrites the file from the current counts — that is `typescript
 * baseline`, a command of its own because it RECORDS rather than checks or
 * repairs. `--linter-exit` is the exit code of the human run beside the JSON
 * one: a linter that failed with no diagnostic at all failed for a reason no
 * count can forgive (a config it could not load), and the judge says so.
 * Exit code: 0 when the ratchet holds, 1 otherwise.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The file, at the project root, tracked beside the config it ratchets. */
export const BASELINE = 'typescript.baseline.json';

/** The file `@jterrazz/test` records its own rules in — that package writes and judges it. */
export const TEST_BASELINE = 'test.baseline.json';

/** The namespaces `@jterrazz/test` owns: its oxlint plugin's rules and its checker's ids. */
const TEST_NAMESPACES = ['jterrazz/', 'jterrazz-check/'];

/** The namespace the Names (tree) pass's rules take in the file — that pass judges them. */
const NAMES_NAMESPACE = 'names/';

/** `eslint(no-debugger)` is how oxlint's JSON spells `eslint/no-debugger`. */
function ruleOf(code) {
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null ? (code ?? 'unknown') : `${match.groups.plugin}/${match.groups.rule}`;
}

/** Whether a rule key is `@jterrazz/test`'s to record and judge. */
export function isTestOwned(rule) {
    return TEST_NAMESPACES.some((namespace) => rule.startsWith(namespace));
}

/**
 * The diagnostics a report carries. oxlint hands back an object with a
 * `diagnostics` array; the Names pass's `--format json` takes the same shape.
 */
export function diagnosticsOf(report) {
    if (Array.isArray(report)) {
        return report;
    }

    return Array.isArray(report?.diagnostics) ? report.diagnostics : [];
}

/** How many diagnostics each rule THIS package owns accounts for, across every report given. */
export function countsOf(...reports) {
    const counts = {};
    for (const report of reports) {
        for (const diagnostic of diagnosticsOf(report)) {
            const rule = ruleOf(diagnostic.code);
            if (!isTestOwned(rule)) {
                counts[rule] = (counts[rule] ?? 0) + 1;
            }
        }
    }

    return counts;
}

/** The recorded counts of `file` (defaulting to this package's own), or null when it is absent. */
export function readBaseline(root, file = BASELINE) {
    const path = join(root, file);
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
        if (isTestOwned(rule)) {
            broken.push(
                `${rule} is @jterrazz/test's rule — its entry belongs in ${TEST_BASELINE}, which that package records and judges`,
            );
        } else if ((counts[rule] ?? 0) === 0) {
            broken.push(`${rule} is at zero — the ratchet moved, delete its entry`);
        }
    }

    return broken;
}

/**
 * The one line a green ratchet prints: what the file holds, by count and by
 * rule. The findings themselves print only with a failing verdict, where they
 * are the evidence.
 */
export function heldSummary(counts) {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const rules = Object.keys(counts).length;

    return `${BASELINE}: ${total} held across ${rules} rule${rules === 1 ? '' : 's'}`;
}

/** The file's text: sorted, two-space, so a diff reads as a burn-down. */
function serialise(counts) {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([left], [right]) => (left < right ? -1 : 1)),
    );

    return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** The value an argument list carries after a flag, or undefined when it has none. */
function valueOf(flag) {
    const index = argv.indexOf(flag);

    return index === -1 ? undefined : argv[index + 1];
}

/* Imported for the ratchet's reading, run for the gate — never both at once. */
if (import.meta.main) {
    const isWrite = argv.includes('--write');
    const namesPath = valueOf('--names');
    const linterExit = valueOf('--linter-exit');
    const flagValues = new Set([namesPath, linterExit].filter((value) => value !== undefined));
    const positional = argv
        .slice(2)
        .filter((argument) => !argument.startsWith('--') && !flagValues.has(argument));
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

    /* Recorded, or summed into the file's line — never judged: the Names (tree) pass judges its own entries. */
    let namesReport = [];
    if (namesPath !== undefined) {
        try {
            namesReport = JSON.parse(readFileSync(namesPath, 'utf8'));
        } catch {
            namesReport = [];
        }
    }

    const counts = countsOf(report, namesReport);
    const linterCounts = countsOf(report);

    if (isWrite) {
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        writeFileSync(join(root, BASELINE), serialise(counts));
        stdout.write(
            `${BASELINE} written — ${total} diagnostic(s) across ${Object.keys(counts).length} rule(s)\n`,
        );
        exit(0);
    }

    /*
     * A linter that failed and reported nothing failed on something no
     * diagnostic carries; setting test-owned findings aside must not turn
     * that into a green pass.
     */
    if (linterExit !== undefined && linterExit !== '0' && diagnosticsOf(report).length === 0) {
        stdout.write(`oxlint exited ${linterExit} with no diagnostic — its own output says why\n`);
        exit(1);
    }

    const whole = readBaseline(root);

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
        exit(rules.length > 0 ? 1 : 0);
    }

    const baseline = Object.fromEntries(
        Object.entries(whole).filter(([rule]) => !rule.startsWith(NAMES_NAMESPACE)),
    );
    const broken = judge(linterCounts, baseline);

    for (const reason of broken) {
        stdout.write(`baseline-ratchet  ${BASELINE}  ${reason}\n`);
    }
    if (broken.length > 0) {
        stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
        exit(1);
    }

    if (namesPath !== undefined && judge(counts, whole).length === 0) {
        stdout.write(`${heldSummary(counts)}\n`);
    }

    exit(0);
}
