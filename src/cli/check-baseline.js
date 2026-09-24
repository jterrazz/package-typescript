#!/usr/bin/env node

/**
 * The migration ratchet: a count per rule that may fall and never rise.
 *
 * A project adopting a stricter rulebook has two honest options — burn every
 * diagnostic down before the first green run, or record where it stands and
 * refuse to go backwards. `jterrazz.baseline.json` is the second: one file for
 * the whole toolchain family, one section per package — `{ "typescript": {
 * "<rule>": <count> }, "test": { … } }` — tracked, and read by the oxlint pass
 * instead of the raw exit code. Without this package's section every
 * diagnostic this package owns is a failure.
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
 * The `typescript` section holds this package's rules and nothing else.
 * oxlint's JSON report also carries the `jterrazz(*)` rules a consumer
 * composes in from `@jterrazz/test`'s `testing` fragment; those, and the
 * conventions checker's `jterrazz-check/*` findings, are the `test` section's
 * — that package records and judges them. So a diagnostic whose plugin is
 * `jterrazz` is set aside before the counting, and an entry under either of
 * that package's namespaces in THIS section is refused as misplaced: one
 * finding, one section, one judge. Writing the `typescript` section leaves
 * every other section's text exactly as it was.
 *
 * A second reporter is recorded here and judged elsewhere: the Names (tree)
 * pass's findings enter the section under `names/<rule>` when `--names <json>`
 * is given to `--write`, and that pass reads its own entries back. So a
 * judging run sets every `names/*` entry aside — this is not the judge of it.
 *
 * A green run speaks once about the section, never about a held finding: given
 * `--names <json>` beside a judging run, it prints one line for the WHOLE
 * section — `jterrazz.baseline.json › typescript: <n> held across <k> rules`,
 * the shape `@jterrazz/test` gives its own — when both reporters' counts sit
 * within it. Where either side breaks the ratchet it prints no summary: the
 * pass that owns the broken entry prints the evidence.
 *
 * A file of the per-package layout — `typescript.baseline.json`,
 * `test.baseline.json`, `oxlint.baseline.json` — is never read: its presence
 * fails the run with the section its entries move to.
 *
 * Usage: node check-baseline.js <oxlint-json> [root] [--names <json>] [--write]
 *                               [--linter-exit <code>]
 *
 * `--write` rewrites the section from the current counts — that is
 * `typescript baseline`, a command of its own because it RECORDS rather than
 * checks or repairs. `--linter-exit` is the exit code of the human run beside
 * the JSON one: a linter that failed with no diagnostic at all failed for a
 * reason no count can forgive (a config it could not load), and the judge
 * says so. Exit code: 0 when the ratchet holds, 1 otherwise.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The file, at the project root, tracked beside the config it ratchets. */
export const BASELINE = 'jterrazz.baseline.json';

/** The section this package records and judges. */
export const SECTION = 'typescript';

/** The section `@jterrazz/test` records its own rules in — that package writes and judges it. */
export const TEST_SECTION = 'test';

/** How a section is named to a reader: the file, then the section. */
export const labelOf = (section) => `${BASELINE} › ${section}`;

/** This package's section, as every line about it names it. */
export const LABEL = labelOf(SECTION);

/** The files of the per-package layout, each mapped to the section its entries belong in. */
const LEGACY = Object.freeze({
    'oxlint.baseline.json': SECTION,
    'test.baseline.json': TEST_SECTION,
    'typescript.baseline.json': SECTION,
});

/** The namespaces `@jterrazz/test` owns: its oxlint plugin's rules and its checker's ids. */
const TEST_NAMESPACES = ['jterrazz/', 'jterrazz-check/'];

/** The namespace the Names (tree) pass's rules take in the section — that pass judges them. */
const NAMES_NAMESPACE = 'names/';

/** oxlint's own "Unused eslint/oxlint-disable directive" findings carry no `code` at all. */
const UNUSED_DIRECTIVE = /^Unused (?:eslint|oxlint)-disable directive/u;

/** `eslint(no-debugger)` is how oxlint's JSON spells `eslint/no-debugger`; an unused directive has no code. */
function ruleOf(diagnostic) {
    const code = diagnostic.code;
    if (code === undefined && UNUSED_DIRECTIVE.test(diagnostic.message ?? '')) {
        return 'oxlint/unused-directive';
    }
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null ? (code ?? 'unknown') : `${match.groups.plugin}/${match.groups.rule}`;
}

/** Whether a rule key is `@jterrazz/test`'s to record and judge. */
export function isTestOwned(rule) {
    return TEST_NAMESPACES.some((namespace) => rule.startsWith(namespace));
}

/** A plain object — never an array, never null. */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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
            const rule = ruleOf(diagnostic);
            if (!isTestOwned(rule)) {
                counts[rule] = (counts[rule] ?? 0) + 1;
            }
        }
    }

    return counts;
}

/**
 * The whole file: `{ sections }` when it reads, `{ sections: null }` when the
 * project keeps none, and `{ problem }` when it is there and holds no sections.
 */
export function readRatchet(root) {
    const path = join(root, BASELINE);
    if (!existsSync(path)) {
        return { problem: null, sections: null };
    }

    let parsed;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return { problem: `is not JSON — ${error.message}`, sections: null };
    }
    if (!isRecord(parsed)) {
        return { problem: 'holds no object of sections', sections: null };
    }
    for (const [name, section] of Object.entries(parsed)) {
        if (!isRecord(section)) {
            return {
                problem: `keys \`${name}\` to something that is not a section of counts`,
                sections: null,
            };
        }
    }

    return { problem: null, sections: parsed };
}

/**
 * The recorded counts of one section (this package's by default), or null
 * when the project records none there — no file, an unreadable one, or no
 * such section. The oxlint pass is the one that reports an unreadable file.
 */
export function readBaseline(root, section = SECTION) {
    const { sections } = readRatchet(root);

    return sections?.[section] ?? null;
}

/** Every file of the per-package layout still at the root, with what it owes. */
export function legacyOf(root) {
    return Object.entries(LEGACY)
        .filter(([file]) => existsSync(join(root, file)))
        .map(([file, section]) =>
            section === SECTION
                ? `${file}  the ratchet is ${LABEL} — run 'typescript baseline' to record it there, and delete this file`
                : `${file}  @jterrazz/test's entries belong in ${labelOf(section)} — move them there, and delete this file`,
        );
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
                `${rule} is @jterrazz/test's rule — its entry belongs in ${labelOf(TEST_SECTION)}, which that package records and judges`,
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

    return `${LABEL}: ${total} held across ${rules} rule${rules === 1 ? '' : 's'}`;
}

/** A section's text: sorted, so a diff reads as a burn-down. The formatter owns its indent. */
function serialise(counts) {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([left], [right]) => (left < right ? -1 : 1)),
    );

    return JSON.stringify(sorted, null, 2).replaceAll('\n', '\n  ');
}

/** Where the JSON value starting at `start` ends — past its closing bracket, quote or literal. */
function valueEnd(text, start) {
    const first = text[start];
    if (first === '"') {
        return stringEnd(text, start);
    }
    if (first === '{' || first === '[') {
        return containerEnd(text, start);
    }
    const match = /[\s,\]}]/u.exec(text.slice(start));

    return match === null ? text.length : start + match.index;
}

/** Where the object or array opening at `start` ends, past its closing bracket. */
function containerEnd(text, start) {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const char = text[index];
        if (char === '"') {
            index = stringEnd(text, index);
            continue;
        }
        if (char === '{' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ']') {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
        index += 1;
    }

    return index;
}

/** Where the string literal opening at `start` ends, past its closing quote. */
function stringEnd(text, start) {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
    }

    return index + 1;
}

/**
 * The top-level members of a JSON object's text, each with the span of its
 * value, so one value can be replaced and every other byte kept. The text has
 * already parsed, so the scan never meets malformed input.
 */
function membersOf(text) {
    const members = [];
    let index = text.indexOf('{') + 1;
    while (index < text.length) {
        const opening = text.indexOf('"', index);
        const closing = text.indexOf('}', index);
        if (opening === -1 || (closing !== -1 && closing < opening)) {
            break;
        }
        const keyEnd = stringEnd(text, opening);
        const key = JSON.parse(text.slice(opening, keyEnd));
        let start = text.indexOf(':', keyEnd) + 1;
        while (/\s/u.test(text[start])) {
            start += 1;
        }
        const end = valueEnd(text, start);
        members.push({ end, key, start });
        index = end;
    }

    return members;
}

/**
 * The file's text with this package's section set to `section` — every other
 * byte as it was, so another package's section survives the rewrite whole.
 */
function withSection(text, section) {
    const member = `"${SECTION}": ${section}`;
    if (text === null) {
        return `{\n  ${member}\n}\n`;
    }

    const own = membersOf(text).find(({ key }) => key === SECTION);
    if (own !== undefined) {
        return `${text.slice(0, own.start)}${section}${text.slice(own.end)}`;
    }

    const open = text.indexOf('{') + 1;
    const rest = text.slice(open);

    return /^\s*\}/u.test(rest)
        ? `${text.slice(0, open)}\n  ${member}\n${rest.trimStart()}`
        : `${text.slice(0, open)}\n  ${member},\n  ${rest.trimStart()}`;
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

    /*
     * A linter that failed and reported nothing failed on something no
     * diagnostic carries; setting test-owned findings aside must not turn
     * that into a green pass.
     */
    if (linterExit !== undefined && linterExit !== '0' && diagnosticsOf(report).length === 0) {
        stdout.write(`oxlint exited ${linterExit} with no diagnostic — its own output says why\n`);
        exit(1);
    }

    const legacy = legacyOf(root);
    for (const line of legacy) {
        stdout.write(`baseline-legacy  ${line}\n`);
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
        exit(rules.length > 0 || legacy.length > 0 ? 1 : 0);
    }

    const baseline = Object.fromEntries(
        Object.entries(whole).filter(([rule]) => !rule.startsWith(NAMES_NAMESPACE)),
    );
    const broken = judge(linterCounts, baseline);

    for (const reason of broken) {
        stdout.write(`baseline-ratchet  ${LABEL}  ${reason}\n`);
    }
    if (broken.length > 0) {
        stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
        exit(1);
    }
    if (legacy.length > 0) {
        exit(1);
    }

    if (namesPath !== undefined && judge(counts, whole).length === 0) {
        stdout.write(`${heldSummary(counts)}\n`);
    }

    exit(0);
}
