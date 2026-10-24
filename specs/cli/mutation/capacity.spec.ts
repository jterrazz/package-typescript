import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { temporaryDirectory } from '../../__setup__/temporary-directory.js';
import { cli } from '../cli.specification.js';

const lineOf = (text: string): string | undefined => /^.*capacity: .*$/mu.exec(text)?.[0];

const configOf = (content: string): unknown => JSON.parse(content);

describe('capacity', () => {
    test('sizes the test runners from the capacity given: the memory binds a small one, the cpus a large one, the checker priced apart', async () => {
        // Given - a type-checked project with a module test, given 16 cpus and 2 GB, then 3 cpus and 64 GB
        const small = await cli
            .fixture(directory('./__fixtures__/capacity-app/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=16,memory=2g' })
            .exec('mutation');
        const large = await cli
            .fixture(directory('./__fixtures__/capacity-app/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=3,memory=64g' })
            .exec('mutation');

        // Then - each says what it was given, what it leased and which resource bound the runners, and hands Stryker that many
        expect([small, large].map((result) => lineOf(result.stdout.text))).toStrictEqual([
            ' TYPESCRIPT  capacity: 16 cpus, 2.0 GB, given by TYPESCRIPT_CAPACITY: this gate 16 cpus, 1.8 GB · Stryker at 300 MB, 2 test runner(s) at 650 MB, 1 checker(s) at 720 MB while checking: memory binds',
            ' TYPESCRIPT  capacity: 3 cpus, 64.0 GB, given by TYPESCRIPT_CAPACITY: this gate 3 cpus, 56.0 GB · Stryker at 300 MB, 3 test runner(s) at 650 MB, 2 checker(s) at 720 MB while checking: cpus bind',
        ]);
        expect(
            [small, large].map((result) =>
                configOf(result.file('.artifacts/stryker/stryker.config.json').content),
            ),
        ).toMatchObject([{ concurrency: 2 }, { concurrency: 3 }]);
    });

    test('two gates running at once on one machine lease complementary shares of its cpus', async () => {
        // Given - two checkouts gated at the same moment on a machine of their own, neither given a capacity nor nested in a gate
        const machine = temporaryDirectory('capacity-machine-');
        const alone = { TMPDIR: machine, TYPESCRIPT_CAPACITY: '', TYPESCRIPT_GATE: '' };
        const results = await Promise.all(
            [1, 2].map(
                async () =>
                    await cli
                        .fixture(directory('./__fixtures__/capacity-app/'))
                        .env(alone)
                        .exec('mutation'),
            ),
        );

        // Then - each counts two gates, and their shares add up to the machine's cpus
        const leased = results.map(
            (result) =>
                /capacity: (?<cpus>\d+) cpus, .*, (?<gates>\d+) gate\(s\): this gate (?<share>\d+) cpus/u.exec(
                    result.stdout.text,
                )?.groups,
        );
        expect(leased.map((groups) => groups?.gates)).toStrictEqual(['2', '2']);
        expect(leased.reduce((sum, groups) => sum + Number(groups?.share), 0)).toBe(
            Number(leased[0]?.cpus),
        );
    });
});
