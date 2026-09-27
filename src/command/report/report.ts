// oxlint picks its print form from the environment, so the form is never guessed: the same binary
// lints a one-line probe here, and what it printed names the form.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { reportOf } from './diagnostic.js';
import type { Report } from './diagnostic.js';
import { drawGraphical } from './graphical.js';
import { agentLine, closingLines, githubLine } from './lines.js';
import { sourceOf } from './source.js';
import type { Source } from './source.js';
import { themeOf } from './theme.js';

export type Form = 'agent' | 'framed' | 'framed-colour' | 'github';

const REPORT_OPENING = '{ "diagnostics": ';

export function splitReport(text: string): { before: string; report: null | Report } {
    const inside = text.indexOf(`\n${REPORT_OPENING}`);
    const at = text.startsWith(REPORT_OPENING) ? 0 : inside === -1 ? -1 : inside + 1;
    if (at === -1) {
        return { before: text, report: null };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text.slice(at));
    } catch {
        return { before: text, report: null };
    }

    return { before: text.slice(0, at), report: reportOf(parsed) };
}

export function formOf(printed: string): Form {
    if (printed.startsWith('::')) {
        return 'github';
    }
    if (/^\S+:\d+:\d+: \w+ /u.test(printed)) {
        return 'agent';
    }

    return printed.includes('\u001B[') ? 'framed-colour' : 'framed';
}

// The config is named, never discovered: discovery is the slow part of a start.
function probeForm(oxlint: string): Form {
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

type Read = (path: string) => Buffer | null;

function sourcesFrom(read: Read): (filename: string | undefined) => null | Source {
    const sources = new Map<string, null | Source>();

    return (filename) => {
        if (filename === undefined) {
            return null;
        }
        const known = sources.get(filename);
        if (known !== undefined) {
            return known;
        }
        const data = read(filename);
        const source = data === null ? null : sourceOf(data);
        sources.set(filename, source);

        return source;
    };
}

export function renderReport(report: Report, form: Form, read: Read): string {
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

function holdsDiagnostics(report: null | Report): boolean {
    return (report?.diagnostics ?? []).length > 0;
}

function readOrNothing(path: string): Buffer | null {
    try {
        return readFileSync(path);
    } catch {
        return null;
    }
}

export function oxlintReport({
    ifDiagnostics,
    oxlint,
    stderrFile,
    stdoutFile,
}: {
    ifDiagnostics: boolean;
    oxlint: string;
    stderrFile: string;
    stdoutFile: string;
}): string {
    const { before, report } = splitReport(readOrNothing(stdoutFile)?.toString('utf8') ?? '');
    if (ifDiagnostics && !holdsDiagnostics(report)) {
        return '';
    }
    const errors = readOrNothing(stderrFile)?.toString('utf8') ?? '';
    const drawn = report === null ? '' : renderReport(report, probeForm(oxlint), readOrNothing);

    return `${before}${errors}${drawn}`;
}
