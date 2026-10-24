import { describe, expect, test } from 'vitest';

import type { Instrumented } from '../../../../drivers/stryker/enumerate.js';
import { carriedOf } from '../carried.js';
import type { CarriedCompileError } from '../carried.js';

const SOURCE = "export function a(): string {\n    return 'a';\n}\n";

const made = (
    mutator: string,
    replacement: string,
    [line, column, endLine, endColumn]: readonly [number, number, number, number],
    file = 'src/a.ts',
): Instrumented => ({
    column,
    endColumn,
    endLine,
    file,
    ignored: false,
    line,
    mutator,
    replacement,
});

const BLOCK = made('BlockStatement', '{}', [1, 29, 3, 2]);
const TEXT = made('StringLiteral', '""', [2, 12, 2, 15]);

const reported = (
    id: string,
    { column, endColumn, endLine, line, mutator, replacement }: Instrumented,
    status: string,
    killedBy: readonly string[] = [],
) => ({
    coveredBy: [...killedBy],
    id,
    killedBy: [...killedBy],
    location: { end: { column: endColumn, line: endLine }, start: { column, line } },
    mutatorName: mutator,
    replacement,
    status,
});

const reportWith = (mutants: readonly object[], file = 'src/a.ts') => ({
    files: { [file]: { mutants, source: SOURCE } },
    schemaVersion: '2',
});

const KILLED_TEXT = reported('1', TEXT, 'Killed', ['7']);

type Options = {
    fresh?: boolean;
    mutants?: readonly Instrumented[];
    mutate?: readonly string[];
    refused?: ReadonlySet<string> | undefined;
    text?: string;
};

async function carriedFor(
    report: Record<string, unknown> | undefined,
    {
        fresh = false,
        mutants = [BLOCK, TEXT],
        mutate = ['src/a.ts:1-3'],
        refused = new Set(),
        text = SOURCE,
    }: Options = {},
) {
    const asked: (readonly CarriedCompileError[])[] = [];
    const carried = await carriedOf({
        fresh,
        instrumented: async () => await Promise.resolve(mutants),
        mutate,
        refusedAmong: async (uncompiled) => {
            asked.push(uncompiled);

            return await Promise.resolve(refused);
        },
        report,
        textOf: () => text,
    });

    return { asked, carried };
}

describe('carried', () => {
    test('carriedOf — a kill is carried, and a compile error the compiler still refuses, handed to it at its span counted from 0', async () => {
        // Given - a report holding the body's compile error and the text's kill, the compiler refusing the first
        const report = reportWith([reported('0', BLOCK, 'CompileError'), KILLED_TEXT]);

        const { asked, carried } = await carriedFor(report, { refused: new Set(['0']) });

        // Then - nothing runs, and the checker was asked the compile error alone
        expect(carried).toStrictEqual({ made: 2, running: new Set() });
        expect(asked).toStrictEqual([
            [
                {
                    fileName: 'src/a.ts',
                    id: '0',
                    location: { end: { column: 1, line: 2 }, start: { column: 28, line: 0 } },
                    replacement: '{}',
                },
            ],
        ]);
    });

    test('carriedOf — a stage whose report holds no compile error asks the checker nothing, and a report the change left none of carries nothing', async () => {
        // Given - a report of two kills, and no report at all
        const kills = reportWith([reported('0', BLOCK, 'Killed', ['7']), KILLED_TEXT]);

        const held = await carriedFor(kills);
        const none = await carriedFor(undefined);

        // Then - both carried with no checker asked; no report, no carriage
        expect([held.carried, held.asked]).toStrictEqual([{ made: 2, running: new Set() }, []]);
        expect(none).toStrictEqual({ asked: [], carried: undefined });
    });

    test.each([
        ['a compile error the compiler no longer refuses', 'CompileError', {}],
        ['a compile error where no checker opens', 'CompileError', { refused: undefined }],
        ['a mutant the report does not hold', 'absent', {}],
        ['a kill with no killer', 'Killed', {}],
        ['a survivor once a test is fresh', 'Survived', { fresh: true }],
        ['a timeout once a test is fresh', 'Timeout', { fresh: true }],
        ['a status Stryker never reuses', 'Pending', {}],
        ['a source whose text is not the report’s', 'Survived', { text: `${SOURCE}\n` }],
    ] as const)('carriedOf — %s runs its source', async (_case, status, options) => {
        // Given - a report holding the body as the case says, beside the text's kill
        const body = status === 'absent' ? [] : [reported('0', BLOCK, status)];

        const { carried } = await carriedFor(reportWith([...body, KILLED_TEXT]), options);

        // Then - the source is Stryker's to judge
        expect(carried?.running).toStrictEqual(new Set(['src/a.ts']));
    });

    test.each(['Survived', 'Timeout', 'NoCoverage', 'RuntimeError', 'Ignored'])(
        'carriedOf — a mutant whose result is %s is carried while no test is fresh, and runs once one is',
        async (status) => {
            // Given - a report holding the body's result beside the text's kill
            const report = reportWith([reported('0', BLOCK, status), KILLED_TEXT]);

            const held = await carriedFor(report);
            const fresh = await carriedFor(report, { fresh: true });

            // Then - carried, then run
            expect([held.carried?.running, fresh.carried?.running]).toStrictEqual([
                new Set(),
                new Set(['src/a.ts']),
            ]);
        },
    );

    test('carriedOf — a survivor that lists a killer is judged as a survivor, never as a kill', async () => {
        // Given - a survivor whose report names a test among its killers, a test being fresh
        const report = reportWith([reported('0', BLOCK, 'Survived', ['7']), KILLED_TEXT]);

        const { carried } = await carriedFor(report, { fresh: true });

        // Then - it runs, as a survivor a fresh test may now detect
        expect(carried?.running).toStrictEqual(new Set(['src/a.ts']));
    });

    test('carriedOf — a mutant an ignorer set aside is carried only where the report holds it ignored', async () => {
        // Given - the text set aside by an ignorer, its report holding it ignored, then killed
        const setAside = [BLOCK, { ...TEXT, ignored: true }];
        const ignored = reportWith([
            reported('0', BLOCK, 'Killed', ['7']),
            reported('1', TEXT, 'Ignored'),
        ]);

        const held = await carriedFor(ignored, { fresh: true, mutants: setAside });
        const judged = await carriedFor(
            reportWith([reported('0', BLOCK, 'Killed', ['7']), KILLED_TEXT]),
            {
                mutants: setAside,
            },
        );

        // Then - carried while ignored on both sides, run where the report judged it
        expect([held.carried?.running, judged.carried?.running]).toStrictEqual([
            new Set(),
            new Set(['src/a.ts']),
        ]);
    });

    test('carriedOf — a mutant outside the stage’s entries is not the stage’s, and a file reaching Stryker whole always runs', async () => {
        // Given - the body made outside the range the stage holds, and a file whose name holds a braced comma
        const report = reportWith([KILLED_TEXT]);
        const braced = made('StringLiteral', '""', [2, 12, 2, 15], 'src/{a,b}.ts');

        const ranged = await carriedFor(report, { mutate: ['src/a.ts:2-2'] });
        const widened = await carriedFor(
            reportWith([reported('1', braced, 'Killed', ['7'])], 'src/{a,b}.ts'),
            {
                mutants: [braced],
                mutate: ['src/{a,b}.ts'],
            },
        );

        // Then - the text alone is made and carried; the braced file runs
        expect(ranged.carried).toStrictEqual({ made: 1, running: new Set() });
        expect(widened.carried?.running).toStrictEqual(new Set(['src/{a,b}.ts']));
    });
});
