import { positionAt } from './oxlint-report-source.js';

const NOWHERE = { column: 0, line: 0 };

// As in oxlint, a diagnostic whose first label falls outside its file has no position.
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

function collapseWhitespace(text) {
    return text
        .split(/\s+/u)
        .filter((word) => word !== '')
        .join(' ');
}

export function agentLine(diagnostic, source) {
    const extent = extentOf(diagnostic, source);
    const filename =
        diagnostic.filename === undefined || diagnostic.filename === ''
            ? '<unknown>'
            : diagnostic.filename;
    const location = extent === null ? '' : `:${extent.start.line}:${extent.start.column}`;
    const rule = diagnostic.code === undefined ? '' : ` ${diagnostic.code}`;
    const help =
        diagnostic.help === undefined ? '' : ` help: ${collapseWhitespace(diagnostic.help)}`;

    return `${filename}${location}: ${diagnostic.severity}${rule}: ${collapseWhitespace(diagnostic.message)}${help}\n`;
}

function escapeData(value) {
    return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(value) {
    return escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

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

// As oxlint says it: whole milliseconds under a second, tenths of a second above.
function durationOf(seconds) {
    const nanoseconds = Math.round(seconds * 1e9);
    const milliseconds = Math.floor(nanoseconds / 1e6);

    return milliseconds < 1000 ? `${milliseconds}ms` : `${(nanoseconds / 1e9).toFixed(1)}s`;
}

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
