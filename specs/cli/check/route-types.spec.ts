import { directory } from '@jterrazz/test';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// invariant: the unit's own `react-router`, a script here, stands for the route generator and answers the way the test asks.
const generator = (status: number) => (workdir: string) => {
    const bin = join(workdir, 'node_modules/.bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(
        join(bin, 'react-router'),
        `#!/bin/sh\necho "route generator ran: $*"\nexit ${String(status)}\n`,
    );
    chmodSync(join(bin, 'react-router'), 0o755);
};

const typed = cli.with({ env: onlyPasses('typescript') });

describe('route-types', () => {
    test('fails the type check of a React Router unit whose route generator fails, with the generator’s own words', async () => {
        // Given - a unit declaring @react-router/dev whose generator exits 5
        const result = await typed
            .fixture(directory('./__fixtures__/route-types/'))
            .prepare(generator(5))
            .exec('check');

        // Then - the type check is red, and says what the generator printed
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('route generator ran: typegen');
    });

    test('type checks a React Router unit whose route generator succeeds', async () => {
        // Given - the same unit, the generator exiting 0
        const result = await typed
            .fixture(directory('./__fixtures__/route-types/'))
            .prepare(generator(0))
            .exec('check');

        // Then - nothing is red
        expect(result.exitCode).toBe(0);
    });
});
