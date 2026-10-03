import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHECK_PASSES } from '../../../src/command/check/passes.js';
import { PROFILES } from '../../consumer/rulebook/profiles.js';
import { decisions } from '../../kit/catalogue/decisions.js';
import { AUDIENCES } from '../../kit/compiler/decision.js';
import { shippedModules } from '../../kit/testing/shipped-modules.js';
import { CHANNELS, fieldText, REFUSALS, ROOT, rows, rowsOf } from './audience.js';

// invariant: a `self` row names the home that holds it — a path the package leaves out — and the names the tarball audit greps for.

function byName(left: string, right: string): number {
    return left.localeCompare(right);
}

describe('audience', () => {
    test('every profile carries consumer fragments alone', () => {
        // Given - the fragments each shipped profile is compiled from
        // Then - none is the package's own discipline
        for (const [name, profile] of Object.entries(PROFILES)) {
            for (const fragment of profile.fragments) {
                expect.soft(fragment.audience, `${name} carries ${fragment.id}`).toBe('consumer');
            }
        }
    });

    test('every catalogue entry carries the audience its fragment declared', () => {
        // Given - the catalogue, every decision of every profile
        // Then - each entry says who it is for
        for (const entry of decisions(PROFILES)) {
            expect.soft(AUDIENCES, `${entry.rule} has no audience`).toContain(entry.audience);
        }
    });

    test('every row of the manifest declares its audience, on a channel of its own', () => {
        // Given - every rule the manifest holds
        expect(rows.length).toBeGreaterThan(20);
        const ids = rows.map((row) => fieldText(row, 'id'));

        // Then - each names an audience of the pair and a channel, under an id no other row takes
        for (const row of rows) {
            expect
                .soft(AUDIENCES, `${fieldText(row, 'id')} declares no audience`)
                .toContain(row.audience);
            expect
                .soft(CHANNELS, `${fieldText(row, 'id')} sits on no channel`)
                .toContain(row.channel);
        }
        expect(ids.filter((id, index) => id === '' || ids.indexOf(id) !== index)).toStrictEqual([]);
    });

    test('the consumer passes are exactly the passes the check selects by name', () => {
        // Given - every pass the command's check can select
        // Then - the manifest's consumer checker rows name each one, and nothing else
        expect(
            rowsOf('checker', 'consumer')
                .map((row) => fieldText(row, 'id'))
                .toSorted(byName),
        ).toStrictEqual([...CHECK_PASSES].toSorted(byName));
    });

    test('every refusal a shipped module makes is a consumer row, and every row is still there', () => {
        // Given - every shipped module of lint/ and src/, and the runtime rows of the manifest
        const modules = ['lint', 'src'].flatMap((folder) =>
            shippedModules(ROOT, join(ROOT, folder)),
        );
        const runtime = rows.filter((row) => row.channel === 'runtime');

        // Then - a module refuses in each way as often as its rows declare, each consumer, each still worded so
        for (const module of modules) {
            const source = readFileSync(join(ROOT, module), 'utf8');
            for (const [by, spelling] of Object.entries(REFUSALS)) {
                const made = source.match(spelling)?.length ?? 0;
                const declaredRefusals = runtime.filter(
                    (row) => row.module === module && row.by === by,
                );
                expect
                    .soft(
                        declaredRefusals.length,
                        `${module} refuses by ${by} where no row declares it`,
                    )
                    .toBe(made);
            }
        }
        for (const row of runtime) {
            const module = fieldText(row, 'module');
            expect
                .soft(Object.keys(REFUSALS), `${fieldText(row, 'id')} refuses no known way`)
                .toContain(row.by);
            expect
                .soft(row.audience, `${fieldText(row, 'id')} ships, so it is consumer`)
                .toBe('consumer');
            expect
                .soft(
                    existsSync(join(ROOT, module)) && readFileSync(join(ROOT, module), 'utf8'),
                    `${fieldText(row, 'id')} is no longer worded so in ${module}`,
                )
                .toContain(fieldText(row, 'message'));
        }
    });

    test('a refusal counts however it is spelled, and a rethrow or a clean exit does not', () => {
        // Given - each spelling of a refusal, and each of what is none
        const spellings: Record<string, { counted: string[]; none: string[] }> = {
            exit: {
                counted: ['exit(1);', 'process.exit(code);'],
                none: ['exit(0);', "'--linter-exit'"],
            },
            reject: { counted: ['reject(new Error(x));', 'reject(error);', 'reject();'], none: [] },
            throw: {
                counted: ['throw new TypeError(x);', 'throw Error(x);', 'throw errors.refused(x);'],
                none: ['throw error;', "'only-throw-error'"],
            },
        };

        // Then - every spelling counts once, where it is written, and nothing else counts
        for (const [by, spelling] of Object.entries(REFUSALS)) {
            const cases = spellings[by] ?? { counted: [], none: [] };
            expect.soft(by in spellings, `${by} has no spelling proved`).toBe(true);
            for (const line of cases.counted) {
                expect.soft(line.match(spelling)?.length, `${line} is no ${by}`).toBe(1);
            }
            for (const line of cases.none) {
                expect.soft(line.match(spelling), `${line} counts`).toBeNull();
            }
        }
    });

    test('every self row names the home that holds it, which the package leaves out', () => {
        // Given - every path npm would publish, and the self rows of the manifest
        const run = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        const packed = run.stdout;
        const self = rows.filter((row) => row.audience === 'self');
        expect(self.length).toBeGreaterThan(0);

        // Then - each home exists here, ships nowhere, and holds every name the row greps for
        for (const row of self) {
            const home = fieldText(row, 'home');
            const names: unknown[] = Array.isArray(row.names) ? row.names : [];
            const source = existsSync(join(ROOT, home))
                ? readFileSync(join(ROOT, home), 'utf8')
                : '';
            expect.soft(source, `${fieldText(row, 'id')} has no home`).not.toBe('');
            expect
                .soft(packed, `${fieldText(row, 'id')} ships its home`)
                .not.toContain(`"${home}"`);
            expect
                .soft(fieldText(row, 'why'), `${fieldText(row, 'id')} says not why it stays home`)
                .not.toBe('');
            expect
                .soft(names.length, `${fieldText(row, 'id')} names nothing to grep for`)
                .toBeGreaterThan(0);
            for (const name of names) {
                expect.soft(source, `${basename(home)} holds no "${String(name)}"`).toContain(name);
            }
        }
    });
});
