#!/usr/bin/env node

/**
 * The Oxlint pass's log, drawn from the one run `check` makes: oxlint's JSON
 * report, printed back in the form oxlint itself would have printed here.
 *
 * `check` lints once, with `--format json`, because every reader of the run
 * needs the report — the ratchet counts it, the conventions checker's member
 * runs judge their rules in it — and only a failing pass needs the log. That
 * log is what a reader of the pass has always seen, so it is the linter's
 * own: the same lines, in the same order, in the same colours.
 *
 * Which form that is, oxlint decides from the environment — one line per
 * diagnostic under an AI agent, GitHub workflow commands on a GitHub runner,
 * the framed report anywhere else, in colour where `CI` or `FORCE_COLOR` asks
 * for it. So the form is never guessed here: the same binary, in the same
 * environment, lints a one-line file under a config of its own, and what it
 * printed names the form.
 *
 * Whatever oxlint printed before its report — `No files found to lint`, a
 * config it could not parse and the report that never came — is printed as it
 * came, then its standard error, then the report drawn.
 *
 * Usage: node oxlint-report.js <stdout-file> <stderr-file> --oxlint <binary>
 */

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

/**
 * What oxlint printed, cut where its JSON report opens: the text before it,
 * and the report — or the whole text, and a null report, where none came.
 */
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

/** The form oxlint printed a one-line lint in: `agent`, `github`, `framed` or `framed-colour`. */
export function formOf(printed) {
    if (printed.startsWith('::')) {
        return 'github';
    }
    if (/^\S+:\d+:\d+: \w+ /u.test(printed)) {
        return 'agent';
    }

    return printed.includes('\u001B[') ? 'framed-colour' : 'framed';
}

/**
 * Ask oxlint, in this environment, to lint one line, and read the form it
 * answered in. The config is named, never discovered: discovery is the slow
 * part of a start, and the probe must cost nothing beside the run it follows.
 */
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

/** A reader of the files the report names, each read once, and null for one that is gone. */
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

/** The report, drawn in a form; `read(filename)` hands back a file's bytes, or null. */
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
            'Usage: node oxlint-report.js <stdout-file> <stderr-file> --oxlint <binary>\n',
        );
        exit(2);
    }
    const { before, report } = splitReport(readOrNothing(stdoutFile)?.toString('utf8') ?? '');
    const errors = readOrNothing(stderrFile)?.toString('utf8') ?? '';
    const drawn = report === null ? '' : renderReport(report, probeForm(oxlint), readOrNothing);
    stdout.write(`${before}${errors}${drawn}`);
}

if (import.meta.main) {
    main();
}
