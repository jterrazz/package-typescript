#!/usr/bin/env node

// The section is exact: a count above OR below its entry fails, and only `typescript baseline` raises one.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

export const BASELINE = 'jterrazz.baseline.json';

export const SECTION = 'typescript';

export const TEST_SECTION = 'test';

export const labelOf = (section) => `${BASELINE} › ${section}`;

export const LABEL = labelOf(SECTION);

// The per-package layout, never read: each file maps to the section its entries move to.
const LEGACY = Object.freeze({
    'oxlint.baseline.json': SECTION,
    'test.baseline.json': TEST_SECTION,
    'typescript.baseline.json': SECTION,
});

// `@jterrazz/test` records and judges these: its oxlint plugin's rules and its checker's ids.
const TEST_NAMESPACES = ['jterrazz/', 'jterrazz-check/'];

const PASS_NAMESPACES = ['names/', 'comments/'];

const isPassOwned = (rule) => PASS_NAMESPACES.some((namespace) => rule.startsWith(namespace));

// oxlint's "Unused eslint/oxlint-disable directive" findings carry no `code` at all.
const UNUSED_DIRECTIVE = /^Unused (?:eslint|oxlint)-disable directive/u;

function ruleOf(diagnostic) {
    const { code } = diagnostic;
    if (code === undefined && UNUSED_DIRECTIVE.test(diagnostic.message ?? '')) {
        return 'oxlint/unused-directive';
    }
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null ? (code ?? 'unknown') : `${match.groups.plugin}/${match.groups.rule}`;
}

export function isTestOwned(rule) {
    return TEST_NAMESPACES.some((namespace) => rule.startsWith(namespace));
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function diagnosticsOf(report) {
    if (Array.isArray(report)) {
        return report;
    }

    return Array.isArray(report?.diagnostics) ? report.diagnostics : [];
}

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

export function readBaseline(root, section = SECTION) {
    const { sections } = readRatchet(root);

    return sections?.[section] ?? null;
}

export function legacyOf(root) {
    return Object.entries(LEGACY)
        .filter(([file]) => existsSync(join(root, file)))
        .map(([file, section]) =>
            section === SECTION
                ? `${file}  the ratchet is ${LABEL} — run 'typescript baseline' to record it there, and delete this file`
                : `${file}  @jterrazz/test's entries belong in ${labelOf(section)} — move them there, and delete this file`,
        );
}

export function judge(counts, baseline, renamed = new Set()) {
    const broken = [];

    for (const [rule, count] of Object.entries(counts).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        const allowed = baseline[rule];
        if (allowed === undefined) {
            broken.push(`${rule} has ${count} diagnostic(s) and no entry — it is new debt`);
        } else if (count > allowed) {
            broken.push(`${rule} is at ${count}, above its baseline of ${allowed}`);
        } else if (count < allowed) {
            broken.push(
                `${rule} is at ${count}, below its baseline of ${allowed} — the debt fell, \`typescript fix\` re-records it`,
            );
        }
    }

    for (const rule of Object.keys(baseline).toSorted()) {
        if (renamed.has(rule)) {
            continue;
        }
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

// Lowers what fell and drops zeros, never raises nor adds a key: debt that grew is `typescript baseline`'s to write.
export function tightened(counts, baseline, owns) {
    const next = {};
    let fell = false;
    for (const [rule, allowed] of Object.entries(baseline)) {
        const count = owns(rule) ? Math.min(counts[rule] ?? 0, allowed) : allowed;
        fell ||= count < allowed;
        if (count > 0) {
            next[rule] = count;
        }
    }

    return fell ? next : undefined;
}

export function reRecord(root, counts, owns) {
    const held = readBaseline(root) ?? {};
    const next = tightened(counts, held, owns);
    if (next === undefined) {
        return { lines: [], section: held };
    }

    const path = join(root, BASELINE);
    const text = readFileSync(path, 'utf8');
    const written = serialise(next, indentOf(text));
    writeFileSync(path, withSection(text, written));
    const lines = Object.keys(held)
        .toSorted()
        .filter((rule) => (next[rule] ?? 0) !== held[rule])
        .map((rule) => `re-recorded ${LABEL} › ${rule} ${held[rule]} → ${next[rule] ?? 0}`);

    return { lines, section: next };
}

export function reKey(root, renamed) {
    const held = readBaseline(root);
    const moved = Object.keys(held ?? {}).filter((rule) => Object.hasOwn(renamed, rule));
    if (moved.length === 0) {
        return [];
    }

    const next = {};
    for (const [rule, count] of Object.entries(held)) {
        const key = renamed[rule] ?? rule;
        next[key] = (next[key] ?? 0) + count;
    }
    const path = join(root, BASELINE);
    const text = readFileSync(path, 'utf8');
    const section = serialise(next, indentOf(text));
    writeFileSync(path, withSection(text, section));

    return moved.toSorted().map((rule) => ({ from: rule, to: renamed[rule] }));
}

export function renamedOf(args) {
    const index = args.indexOf('--renamed');
    if (index === -1 || args[index + 1] === undefined) {
        return new Set();
    }

    const renamed = JSON.parse(readFileSync(args[index + 1], 'utf8'));

    return new Set(Object.keys(renamed));
}

export function heldSummary(counts) {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const rules = Object.keys(counts).length;
    if (rules === 0) {
        return `${LABEL}: nothing held`;
    }

    return `${LABEL}: ${total} held across ${rules} rule${rules === 1 ? '' : 's'}`;
}

// The formatter owns the indent of a file it formatted, so a rewrite keeps the file's own.
function serialise(counts, indent = '  ') {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([left], [right]) => (left < right ? -1 : 1)),
    );

    return JSON.stringify(sorted, null, indent).replaceAll('\n', `\n${indent}`);
}

function indentOf(text) {
    return /\n(?<indent>[ \t]+)"/u.exec(text)?.groups.indent ?? '  ';
}

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

function stringEnd(text, start) {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
    }

    return index + 1;
}

// The text has already parsed, so the scan never meets malformed input.
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

if (import.meta.main) {
    const isWrite = argv.includes('--write');
    const isFix = argv.includes('--fix');
    const namesPath = flagValue('--names');
    const commentsPath = flagValue('--comments');
    const linterExit = flagValue('--linter-exit');
    const renamed = renamedOf(argv);
    const flagValues = new Set(
        [namesPath, commentsPath, linterExit, flagValue('--renamed')].filter(
            (value) => value !== undefined,
        ),
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
        stdout.write(
            `oxlint wrote no JSON report at ${reportPath} — the baseline cannot be read\n`,
        );
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
        if (rules.length > 0 || legacy.length > 0) {
            exit(1);
        }
        if (speaksHeld && judge(counts, {}, renamed).length === 0) {
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

    const baseline = Object.fromEntries(
        Object.entries(section).filter(([rule]) => !isPassOwned(rule)),
    );
    const broken = judge(linterCounts, baseline, renamed);

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

    if (speaksHeld && judge(counts, section, renamed).length === 0) {
        stdout.write(`${heldSummary(counts)}\n`);
    }

    exit(0);
}
