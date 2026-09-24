/**
 * oxlint's two one-line reports, drawn from its JSON one — the compact line
 * per diagnostic it prints for an AI agent, and the GitHub workflow command it
 * prints on a GitHub runner — and the closing lines every form but the agent's
 * ends with.
 *
 * A position is counted on the file's bytes as oxlint counts it: CR, LF and
 * CRLF each end a line, a column is a byte column, and a diagnostic whose first
 * label falls outside its file has no position at all.
 */

import { positionAt } from './oxlint-report-source.js';

const NOWHERE = { column: 0, line: 0 };

/** Where a diagnostic starts and ends, when its first label lies inside its file. */
function extentOf(diagnostic, source) {
    const span = diagnostic.labels?.[0]?.span;
    if (source === null || span === undefined || span.offset + span.length > source.data.length) {
        return null;
    }
    const start = positionAt(source, span.offset);

    return start === null
        ? null
        : { end: positionAt(source, span.offset + span.length) ?? NOWHERE, start };
}

/** Whitespace runs as one space, and none at either end. */
function compact(text) {
    return text
        .split(/\s+/u)
        .filter((word) => word !== '')
        .join(' ');
}

/** The line oxlint prints per diagnostic for an AI agent. */
export function agentLine(diagnostic, source) {
    const extent = extentOf(diagnostic, source);
    const filename =
        diagnostic.filename === undefined || diagnostic.filename === ''
            ? '<unknown>'
            : diagnostic.filename;
    const location = extent === null ? '' : `:${extent.start.line}:${extent.start.column}`;
    const rule = diagnostic.code === undefined ? '' : ` ${diagnostic.code}`;
    const help = diagnostic.help === undefined ? '' : ` help: ${compact(diagnostic.help)}`;

    return `${filename}${location}: ${diagnostic.severity}${rule}: ${compact(diagnostic.message)}${help}\n`;
}

function escapeData(value) {
    return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(value) {
    return escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

/** The workflow command oxlint prints per diagnostic on a GitHub runner. */
export function githubLine(diagnostic, source) {
    const title = diagnostic.code ?? 'oxlint';
    const filename = diagnostic.filename ?? '';
    if (filename === '') {
        const severity = diagnostic.severity === 'error' ? 'error' : 'warning';

        return `::${severity} title=${title}::${escapeData(diagnostic.message)}\n`;
    }
    const extent = extentOf(diagnostic, source);
    const severity = extent !== null && diagnostic.severity === 'error' ? 'error' : 'warning';
    const { end, start } = extent ?? { end: NOWHERE, start: NOWHERE };
    const message = extent === null ? '' : diagnostic.message;

    return (
        `::${severity} file=${escapeProperty(filename)},line=${start.line},endLine=${end.line},` +
        `col=${start.column},endColumn=${end.column},title=${title}::` +
        `${escapeData(filename)}:${start.line}:${start.column}: ${escapeData(message)}\n`
    );
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** How long the run took, as oxlint says it: whole milliseconds under a second, tenths of a second above. */
function durationOf(seconds) {
    const nanoseconds = Math.round(seconds * 1e9);
    const milliseconds = Math.floor(nanoseconds / 1e6);

    return milliseconds < 1000 ? `${milliseconds}ms` : `${(nanoseconds / 1e9).toFixed(1)}s`;
}

/** The count of what was found — only where the linter linted a file — and the run's own line. */
export function closingLines(report) {
    const diagnostics = report.diagnostics ?? [];
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
    const errors = diagnostics.filter(
        (diagnostic) => diagnostic.severity !== 'warning' && diagnostic.severity !== 'advice',
    ).length;
    let text = '';
    if (report.number_of_files > 0) {
        text += warnings + errors > 0 ? '\n' : '';
        text += `Found ${plural(warnings, 'warning')} and ${plural(errors, 'error')}.\n`;
    }
    const files = plural(report.number_of_files, 'file');
    const rules = report.number_of_rules === null ? '' : ` with ${report.number_of_rules} rules`;

    return `${text}Finished in ${durationOf(report.start_time)} on ${files}${rules} using ${report.threads_count} threads.\n`;
}
