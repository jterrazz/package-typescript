#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { judge, LABEL, readBaseline, reRecord } from '../ratchet/baseline.js';
import { commentSpansOf, isDirective, SOURCE } from '../reading/comments.js';
import { ignorePatternsOf, orRefused, projectFiles, readText } from '../reading/project-files.js';

const NAMESPACE = 'comments/';
const RULE = 'comment-lines';
const ENTRY = `${NAMESPACE}${RULE}`;
const GENERATED = /@generated\b/u;
const GENERATED_HEAD_LINES = 5;
const TEST_MARKER = /^\/\/\s*(?:Given|When|Then) - /u;
const READ = 'read: docs/06-quality-checks.md#the-comments-density-pass';

const isProse = (comment) => !isDirective(comment) && !TEST_MARKER.test(comment);

export function commentLinesOf(text) {
    const lines = text.split('\n');
    if (GENERATED.test(lines.slice(0, GENERATED_HEAD_LINES).join('\n'))) {
        return [];
    }
    const spans = commentSpansOf(text);

    return lines.flatMap((line, index) =>
        (spans[index] ?? []).some(([start, end]) => isProse(line.slice(start, end)))
            ? [index + 1]
            : [],
    );
}

function measure(root, ignorePatterns) {
    const found = [];
    let sourceLines = 0;
    for (const path of projectFiles(root, { ignorePatterns }).filter((file) => SOURCE.test(file))) {
        const text = readText(root, path);
        if (text !== null) {
            sourceLines += text.split('\n').length;
            found.push(...commentLinesOf(text).map((line) => ({ line, path })));
        }
    }

    return { found, sourceLines };
}

function densityOf(count, sourceLines) {
    const percent = sourceLines === 0 ? 0 : Math.round((count / sourceLines) * 100);

    return `${count} comment lines — ${percent}% of ${sourceLines} source lines`;
}

function verdictOf(count, recorded, density) {
    const why =
        'why: the default is no comment — a name carries the meaning, and the count is held exactly so no comment arrives unseen';
    if (recorded === undefined) {
        return `found: ${density}, and no \`${ENTRY}\` entry records them · ${why} · fix: delete the comments a name can carry, then run 'typescript baseline' to record the count that is left · ${READ}`;
    }
    if (count > recorded) {
        return `found: ${density}, above the ${recorded} recorded · ${why} · fix: delete the comment, or rename what needed it; one that states what the code cannot (an invariant, a hazard, an external system's constraint) is kept by running 'typescript baseline' · ${READ}`;
    }

    return `found: ${density}, below the ${recorded} recorded · ${why}, and slack left in the entry would let one arrive · fix: run 'typescript fix', which re-records the fall · ${READ}`;
}

const ownedOf = (section) =>
    Object.fromEntries(Object.entries(section).filter(([rule]) => rule.startsWith(NAMESPACE)));

const VALUED_FLAGS = new Set(['--ignore-pattern', '--report']);

if (import.meta.main) {
    const root = resolve(
        argv
            .slice(2)
            .find(
                (argument, index, rest) =>
                    !argument.startsWith('--') && !VALUED_FLAGS.has(rest[index - 1] ?? ''),
            ) ?? '.',
    );
    const { found, sourceLines } = orRefused(() => measure(root, ignorePatternsOf(argv)));
    const report = `${JSON.stringify({
        diagnostics: found.map(({ line, path }) => ({
            code: `comments(${RULE})`,
            filename: path,
            line,
            message: 'a comment line',
            severity: 'error',
        })),
    })}\n`;

    if (argv.includes('--format')) {
        stdout.write(report);
        exit(0);
    }
    const reportPath = argv[argv.indexOf('--report') + 1];
    if (argv.includes('--report') && reportPath !== undefined) {
        writeFileSync(reportPath, report);
    }

    const count = found.length;
    const counts = count > 0 ? { [ENTRY]: count } : {};
    let recorded = ownedOf(readBaseline(root) ?? {});
    if (argv.includes('--fix') && Object.keys(recorded).length > 0) {
        const { lines, section } = reRecord(root, counts, (rule) => rule.startsWith(NAMESPACE));
        stdout.write(lines.map((line) => `${line}\n`).join(''));
        recorded = ownedOf(section);
    }

    const stray = judge(counts, recorded).filter((reason) => !reason.startsWith(`${ENTRY} `));
    if (count !== (recorded[ENTRY] ?? 0)) {
        const density = densityOf(count, sourceLines);
        stdout.write(`${RULE}  ${LABEL}  ${verdictOf(count, recorded[ENTRY], density)}\n`);
    }
    for (const reason of stray) {
        stdout.write(`baseline-ratchet  ${LABEL}  ${reason}\n`);
    }
    exit(count === (recorded[ENTRY] ?? 0) && stray.length === 0 ? 0 : 1);
}
