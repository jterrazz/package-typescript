import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { ignorersSource } from '../../../drivers/stryker/ignorers.js';
import { IGNORERS_FILE } from '../../../drivers/stryker/stryker.js';
import { capHeld, glueCapped, glueOf } from '../glue-cap.js';

const RATES = [
    'export function rated(cents: number): boolean[] {',
    `    return [${Array.from({ length: 16 }, (_, at) => `cents > ${String(at + 1)}`).join(', ')}];`,
    '}',
    '',
].join('\n');

const GLUE = { bar: 0.9, cap: 50, globs: ['**/infrastructure/**'] };

function projectWith(files: Readonly<Record<string, string>>): string {
    const project = mkdtempSync(join(tmpdir(), 'glue-cap-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    for (const [name, text] of Object.entries({ [IGNORERS_FILE]: ignorersSource([]), ...files })) {
        mkdirSync(dirname(join(project, name)), { recursive: true });
        writeFileSync(join(project, name), text);
    }

    return project;
}

describe('glue-cap', () => {
    test('glueCapped — past the cap, a glue file the change reaches gives way to the ranges of the mutants kept; domain and a change within the cap stand', async () => {
        // Given - an adapter whose changed lines make 66 mutants, a domain source as large, both handed to the module tests, and the same adapter reached on its first line alone
        const project = projectWith({
            'src/domain/rated.ts': RATES,
            'src/infrastructure/rates.ts': RATES,
        });
        const whole = await glueCapped(
            project,
            {
                modules: ['src/domain/rated.ts:1-3', 'src/infrastructure/rates.ts:1-3'],
                reached: [],
            },
            GLUE,
        );
        const narrow = await glueCapped(
            project,
            {
                modules: [],
                reached: ['src/domain/rated.ts:1-3', 'src/infrastructure/rates.ts:2-2'],
            },
            GLUE,
        );

        // Then - fifty of the adapter's 66 kept, each a range of its own beside the domain entry; on its second line alone, 65 mutants, still past the cap, and in the suite's entries
        expect([
            whole.capped?.measured.length,
            whole.capped?.of,
            whole.modules.length,
            whole.modules[0],
            whole.reached,
        ]).toStrictEqual([
            50,
            66,
            1 +
                new Set(
                    whole.capped?.measured.map(
                        ({ column, line }) => `${String(line)}:${String(column)}`,
                    ),
                ).size,
            'src/domain/rated.ts:1-3',
            [],
        ]);
        expect([
            narrow.capped?.of,
            narrow.modules,
            narrow.reached[0],
            narrow.reached.some((entry) => entry.startsWith('src/infrastructure/rates.ts:2:')),
        ]).toStrictEqual([65, [], 'src/domain/rated.ts:1-3', true]);
        await expect(
            glueCapped(
                project,
                { modules: ['src/infrastructure/rates.ts:1-3'], reached: [] },
                { ...GLUE, cap: 66 },
            ),
        ).resolves.toStrictEqual({
            capped: undefined,
            modules: ['src/infrastructure/rates.ts:1-3'],
            reached: [],
        });
    });

    test('capHeld and glueOf — a measured stage is cut to the cap and the bar learns what it kept; a failed stage, or a run with no cap, is left as it is', async () => {
        // Given - a cap over the adapter, a measured stage, a failed one
        const project = projectWith({ 'src/infrastructure/rates.ts': RATES });
        const { capped } = await glueCapped(
            project,
            { modules: ['src/infrastructure/rates.ts:1-3'], reached: [] },
            GLUE,
        );
        const measured = {
            ranByTests: new Set<string>(),
            report: {
                files: {
                    'src/infrastructure/rates.ts': {
                        mutants: [
                            {
                                location: { start: { column: 1, line: 1 } },
                                mutatorName: 'BlockStatement',
                                replacement: '{}',
                            },
                        ],
                    },
                },
            },
        };

        // Then - the failed stage stands, the measured one keeps only what the cap kept, and the bar names fifty of 66
        expect(capHeld({ status: 2 }, capped)).toStrictEqual({ status: 2 });
        expect(capHeld(measured, undefined)).toBe(measured);
        expect(capHeld(measured, capped)).toStrictEqual({
            ranByTests: new Set(),
            report: { files: { 'src/infrastructure/rates.ts': { mutants: [] } } },
        });
        expect([glueOf(GLUE, capped), glueOf(GLUE, undefined)]).toStrictEqual([
            { ...GLUE, capped: { measured: 50, of: 66 } },
            GLUE,
        ]);
    });
});
