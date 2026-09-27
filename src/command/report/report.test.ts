import { describe, expect, test } from 'vitest';

import { formOf, renderReport, splitReport } from './report.js';

function reportOf(diagnostics: unknown[]): string {
    return `{ "diagnostics": ${JSON.stringify(diagnostics)},\n  "number_of_files": 2,\n  "number_of_rules": 3,\n  "threads_count": 4,\n  "start_time": 0.0125\n}\n`;
}

function debuggerAt(filename: string, offset: number): unknown {
    return {
        code: 'eslint(no-debugger)',
        filename,
        labels: [{ span: { length: 9, offset } }],
        message: '`debugger` statement is not allowed',
        severity: 'error',
    };
}

describe('report', () => {
    test('keeps what oxlint printed before its report, and reads the report after it', () => {
        // Given - the text oxlint prints when its ignores leave nothing to lint
        const printed = `No files found to lint. Please check your paths and ignore patterns.\n${reportOf([])}`;

        // When - it is cut
        const cut: unknown = splitReport(printed);

        // Then - the message stays whole, and the report is the JSON after it
        expect(cut).toMatchObject({
            before: 'No files found to lint. Please check your paths and ignore patterns.\n',
            report: { diagnostics: [], number_of_files: 2 },
        });
    });

    test('keeps the whole text, and reads no report, where oxlint printed none', () => {
        // Given - the text of a config oxlint could not parse
        const printed =
            'Failed to parse oxlint configuration file.\n\n  x Failed to load JS plugin: ./nowhere.js\n';

        // Then - all of it is printed as it came
        expect(splitReport(printed)).toStrictEqual({ before: printed, report: null });
    });

    test.each([
        {
            form: 'agent',
            printed:
                'probe.js:1:1: error eslint(no-debugger): `debugger` statement is not allowed\n',
        },
        {
            form: 'github',
            printed:
                '::error file=probe.js,line=1,endLine=1,col=1,endColumn=10,title=eslint(no-debugger)::x\n',
        },
        {
            form: 'framed',
            printed:
                '\n  x eslint(no-debugger): `debugger` statement is not allowed\n   ,-[probe.js:1:1]\n',
        },
        {
            form: 'framed-colour',
            printed: '\n  \u001B[38;2;225;80;80;1m×\u001B[0m eslint(no-debugger)\n',
        },
    ])('reads the form oxlint printed a one-line lint in — $form', ({ form, printed }) => {
        // Given - what oxlint printed for the probe, in one environment

        // Then - the answer names the form
        expect(formOf(printed)).toBe(form);
    });

    test('draws the diagnostics in the order of the report, never re-sorted', () => {
        // Given - a report naming the later file first, as a parallel run may
        const { report } = splitReport(reportOf([debuggerAt('b.js', 0), debuggerAt('a.js', 0)]));

        // When - it is drawn one line per diagnostic
        const drawn: unknown = renderReport(report ?? {}, 'agent', () =>
            Buffer.from('debugger;\n'),
        );

        // Then - the lines come in the report's order
        expect(drawn).toBe(
            'b.js:1:1: error eslint(no-debugger): `debugger` statement is not allowed\n' +
                'a.js:1:1: error eslint(no-debugger): `debugger` statement is not allowed\n',
        );
    });

    test('draws nothing for the empty report the pass writes where nothing was linted', () => {
        // Given - the report `check` stands in for a run over no file
        const { report } = splitReport('{ "diagnostics": [] }\n');

        // Then - no count and no duration: no linter ran to have them
        expect(renderReport(report ?? {}, 'framed', () => null)).toBe('');
    });

    test('stops a file at its first frame of 1 200 bytes, and names it as minified', () => {
        // Given - a file whose first line is long enough to be minified, with a second finding below it
        const source = `debugger; var x = ${'1+'.repeat(700)}1;\ndebugger;\n`;
        const diagnostics = [debuggerAt('m.js', 0), debuggerAt('m.js', source.indexOf('\n') + 1)];
        const { report } = splitReport(reportOf(diagnostics));

        // When - it is framed
        const drawn: unknown = renderReport(report ?? {}, 'framed', () => Buffer.from(source));

        // Then - the file is named once as minified, and no frame of it is printed
        expect(drawn).toBe(
            '\n  ! File is too long to fit on the screen\n  help: m.js seems like a minified file\n\n' +
                'Found 0 warnings and 2 errors.\nFinished in 12ms on 2 files with 3 rules using 4 threads.\n',
        );
    });
});
