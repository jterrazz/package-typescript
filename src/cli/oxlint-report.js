#!/usr/bin/env node

// oxlint picks its print form from the environment, so the form is never guessed: the same binary
// lints a one-line probe here, and what it printed names the form.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { drawGraphical } from './oxlint-report-graphical.js';
import { agentLine, closingLines, githubLine } from './oxlint-report-lines.js';
import { sourceOf } from './oxlint-report-source.js';
import { themeOf } from './oxlint-report-theme.js';

const REPORT_OPENING = '{ "diagnostics": ';

export function splitReport(text) {
    const inside = text.indexOf(`\n${REPORT_OPENING}`);
    const at = text.startsWith(REPORT_OPENING) ? 0 : inside === -1 ? -1 : inside + 1;
    if (at === -1) {
        return { before: text, report: null };
    }
    try {
        return { before: text.slice(0, at), report: JSON.parse(text.slice(at)) };
    } catch {
        return { before: text, report: null };
    }
}

export function formOf(printed) {
    if (printed.startsWith('::')) {
        return 'github';
    }
    if (/^\S+:\d+:\d+: \w+ /u.test(printed)) {
        return 'agent';
    }

    return printed.includes('\u001B[') ? 'framed-colour' : 'framed';
}

// The config is named, never discovered: discovery is the slow part of a start.
function probeForm(oxlint) {
    const directory = mkdtempSync(join(tmpdir(), 'jterrazz-oxlint-form-'));
    try {
        writeFileSync(join(directory, 'probe.js'), 'debugger;\n');
        writeFileSync(join(directory, 'probe.json'), '{}\n');
        const probe = spawnSync(
            oxlint,
            ['-c', 'probe.json', '-A', 'all', '-D', 'no-debugger', 'probe.js'],
            { cwd: directory, encoding: 'utf8' },
        );

        return formOf(probe.stdout ?? '');
    } finally {
        rmSync(directory, { force: true, recursive: true });
    }
}

function sourcesFrom(read) {
    const sources = new Map();

    return (filename) => {
        if (filename === undefined) {
            return null;
        }
        if (!sources.has(filename)) {
            const data = read(filename);
            sources.set(filename, data === null ? null : sourceOf(data));
        }

        return sources.get(filename) ?? null;
    };
}

export function renderReport(report, form, read) {
    const source = sourcesFrom(read);
    const diagnostics = report.diagnostics ?? [];
    if (form === 'agent') {
        return diagnostics
            .map((diagnostic) => agentLine(diagnostic, source(diagnostic.filename)))
            .join('');
    }
    const body =
        form === 'github'
            ? diagnostics
                  .map((diagnostic) => githubLine(diagnostic, source(diagnostic.filename)))
                  .join('')
            : drawGraphical(themeOf(form === 'framed-colour'), diagnostics, source);

    return typeof report.number_of_files === 'number' ? `${body}${closingLines(report)}` : body;
}

function holdsDiagnostics(report) {
    return (report?.diagnostics ?? []).length > 0;
}

function readOrNothing(path) {
    try {
        return readFileSync(path);
    } catch {
        return null;
    }
}

function main() {
    const [stdoutFile, stderrFile] = argv.slice(2);
    const oxlint = argv[argv.indexOf('--oxlint') + 1];
    if (stdoutFile === undefined || stderrFile === undefined || oxlint === undefined) {
        stdout.write(
            'Usage: node oxlint-report.js <stdout-file> <stderr-file> --oxlint <binary> [--if-diagnostics]\n',
        );
        exit(2);
    }
    const { before, report } = splitReport(readOrNothing(stdoutFile)?.toString('utf8') ?? '');
    if (argv.includes('--if-diagnostics') && !holdsDiagnostics(report)) {
        return;
    }
    const errors = readOrNothing(stderrFile)?.toString('utf8') ?? '';
    const drawn = report === null ? '' : renderReport(report, probeForm(oxlint), readOrNothing);
    stdout.write(`${before}${errors}${drawn}`);
}

if (import.meta.main) {
    main();
}
