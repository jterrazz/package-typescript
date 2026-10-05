import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHECK_PASSES } from '../../../src/commands/check/passes/passes.js';
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
        const fragments = Object.entries(PROFILES).flatMap(([name, profile]) =>
            profile.fragments.map((fragment) => ({ ...fragment, profile: name })),
        );
        expect(fragments.length).toBeGreaterThan(0);

        // Then - none is the package's own discipline
        expect(
            fragments
                .filter((fragment) => fragment.audience !== 'consumer')
                .map((fragment) => `${fragment.profile} carries ${fragment.id}`),
        ).toStrictEqual([]);
    });

    test('every catalogue entry carries the audience its fragment declared', () => {
        // Given - the catalogue, every decision of every profile
        const entries = decisions(PROFILES);
        expect(entries.length).toBeGreaterThan(0);

        // Then - each entry says who it is for
        expect(
            entries
                .filter((entry) => !AUDIENCES.includes(entry.audience))
                .map((entry) => entry.rule),
        ).toStrictEqual([]);
    });

    test('every row of the manifest declares its audience, on a channel of its own', () => {
        // Given - every rule the manifest holds
        expect(rows.length).toBeGreaterThan(20);
        const ids = rows.map((row) => fieldText(row, 'id'));

        // Then - each names an audience of the pair and a channel, under an id no other row takes
        expect(
            rows.flatMap((row) =>
                [
                    AUDIENCES.some((audience) => audience === row.audience)
                        ? null
                        : `${fieldText(row, 'id')} declares no audience`,
                    CHANNELS.some((channel) => channel === row.channel)
                        ? null
                        : `${fieldText(row, 'id')} sits on no channel`,
                ].filter((broken) => broken !== null),
            ),
        ).toStrictEqual([]);
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

        expect(modules.length).toBeGreaterThan(0);
        expect(runtime.length).toBeGreaterThan(0);

        // Then - a module refuses in each way as often as its rows declare, each consumer, each still worded so
        const undeclared = modules.flatMap((module) => {
            const source = readFileSync(join(ROOT, module), 'utf8');

            return Object.entries(REFUSALS).flatMap(([by, spelling]) => {
                const made = source.match(spelling)?.length ?? 0;
                const declaredRefusals = runtime.filter(
                    (row) => row.module === module && row.by === by,
                ).length;

                return declaredRefusals === made
                    ? []
                    : [
                          `${module} refuses by ${by} ${made} times, and its rows declare ${declaredRefusals}`,
                      ];
            });
        });
        const stale = runtime.flatMap((row) => {
            const id = fieldText(row, 'id');
            const module = fieldText(row, 'module');
            const source = existsSync(join(ROOT, module))
                ? readFileSync(join(ROOT, module), 'utf8')
                : '';

            return [
                Object.keys(REFUSALS).some((by) => by === row.by)
                    ? null
                    : `${id} refuses no known way`,
                row.audience === 'consumer' ? null : `${id} ships, so it is consumer`,
                source.includes(fieldText(row, 'message'))
                    ? null
                    : `${id} is no longer worded so in ${module}`,
            ].filter((broken) => broken !== null);
        });
        expect([...undeclared, ...stale]).toStrictEqual([]);
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
        expect(Object.keys(spellings).toSorted(byName)).toStrictEqual(
            Object.keys(REFUSALS).toSorted(byName),
        );
        expect(
            Object.entries(REFUSALS).flatMap(([by, spelling]) => {
                const cases = spellings[by] ?? { counted: [], none: [] };

                return cases.counted
                    .filter((line) => line.match(spelling)?.length !== 1)
                    .map((line) => `${line} is no ${by}`)
                    .concat(
                        cases.none
                            .filter((line) => line.match(spelling) !== null)
                            .map((line) => `${line} counts`),
                    );
            }),
        ).toStrictEqual([]);
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
        expect(
            self.flatMap((row) => {
                const id = fieldText(row, 'id');
                const home = fieldText(row, 'home');
                const names: unknown[] = Array.isArray(row.names) ? row.names : [];
                const source = existsSync(join(ROOT, home))
                    ? readFileSync(join(ROOT, home), 'utf8')
                    : '';

                return [
                    source === '' ? `${id} has no home` : null,
                    packed.includes(`"${home}"`) ? `${id} ships its home` : null,
                    fieldText(row, 'why') === '' ? `${id} says not why it stays home` : null,
                    names.length === 0 ? `${id} names nothing to grep for` : null,
                ]
                    .filter((broken) => broken !== null)
                    .concat(
                        names
                            .filter((name) => !source.includes(String(name)))
                            .map((name) => `${basename(home)} holds no "${String(name)}"`),
                    );
            }),
        ).toStrictEqual([]);
    });
});
