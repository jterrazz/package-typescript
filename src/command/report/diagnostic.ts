import { invariant } from '../../../lint/engine/catalogue/lesson.js';
import { isJsonObject, isList } from '../../../lint/engine/project/json.js';
import type { JsonObject } from '../../../lint/engine/project/json.js';

export type Span = { length: number; offset: number };

export type Diagnostic = {
    code?: string | undefined;
    filename?: string | undefined;
    help?: string | undefined;
    labels?: { label?: string | undefined; span: Span }[];
    message: string;
    note?: string | undefined;
    severity: string;
};

export const EMPTY_REPORT = '{ "diagnostics": [] }\n';

export type Report = {
    diagnostics?: Diagnostic[];
    number_of_files?: number;
    number_of_rules?: null | number;
    start_time?: number;
    threads_count?: number;
};

function misshapen(what: string): never {
    throw invariant(`oxlint's JSON report is not the shape this reader draws: ${what}`);
}

function objectAt(value: unknown, what: string): JsonObject {
    return isJsonObject(value) ? value : misshapen(`${what} is not an object`);
}

function stringAt(value: unknown, what: string): string {
    return typeof value === 'string' ? value : misshapen(`${what} is not a string`);
}

function numberAt(value: unknown, what: string): number {
    return typeof value === 'number' ? value : misshapen(`${what} is not a number`);
}

function optionalStringAt(value: unknown, what: string): string | undefined {
    return value === undefined ? undefined : stringAt(value, what);
}

function spanOf(value: unknown): Span {
    const { length, offset } = objectAt(value, 'a label span');

    return { length: numberAt(length, 'a span length'), offset: numberAt(offset, 'a span offset') };
}

function labelsOf(value: unknown): NonNullable<Diagnostic['labels']> {
    return (isList(value) ? value : misshapen('`labels` is not a list')).map((entry) => {
        const { label, span } = objectAt(entry, 'a label');

        return { label: optionalStringAt(label, 'a label text'), span: spanOf(span) };
    });
}

function diagnosticOf(value: unknown): Diagnostic {
    const { code, filename, help, labels, message, note, severity } = objectAt(
        value,
        'a diagnostic',
    );

    return {
        code: optionalStringAt(code, '`code`'),
        filename: optionalStringAt(filename, '`filename`'),
        help: optionalStringAt(help, '`help`'),
        ...(labels === undefined ? {} : { labels: labelsOf(labels) }),
        message: stringAt(message, '`message`'),
        note: optionalStringAt(note, '`note`'),
        severity: stringAt(severity, '`severity`'),
    };
}

export function reportOf(parsed: unknown): Report {
    const report = objectAt(parsed, 'the report');
    const { diagnostics, number_of_files, number_of_rules, start_time, threads_count } = report;
    const listed =
        diagnostics === undefined || isList(diagnostics)
            ? diagnostics
            : misshapen('`diagnostics` is not a list');

    return {
        ...(listed === undefined
            ? {}
            : { diagnostics: listed.map((entry) => diagnosticOf(entry)) }),
        ...(number_of_files === undefined
            ? {}
            : { number_of_files: numberAt(number_of_files, '`number_of_files`') }),
        ...(number_of_rules === undefined
            ? {}
            : {
                  number_of_rules:
                      number_of_rules === null
                          ? null
                          : numberAt(number_of_rules, '`number_of_rules`'),
              }),
        ...(start_time === undefined ? {} : { start_time: numberAt(start_time, '`start_time`') }),
        ...(threads_count === undefined
            ? {}
            : { threads_count: numberAt(threads_count, '`threads_count`') }),
    };
}
