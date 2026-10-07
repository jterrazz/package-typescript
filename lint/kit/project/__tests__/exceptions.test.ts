import { describe, expect, test } from 'vitest';

import { exceptionsIn } from '../exceptions.js';

describe('exceptionsIn', () => {
    test('exceptions — counts each setting written with its reason, at any depth, and nothing else', () => {
        // Given - each shape a reason is written in, and settings stating none
        const cases = [
            { reason: 'the packed command', timeout: 120_000 },
            { level: 'off', reason: 'the logs' },
            { '@types/react': 'the specimens', react: 'the specimens' },
            { overrides: [{ files: ['src/**'], reason: 'the adapters', rules: { a: 'off' } }] },
            { methodless: ['/mcp'], projects: { cli: { reason: 'the tarball' } } },
            { mixed: 'a', timeout: 1 },
            { architecture: { hexagonal: true }, roots: {} },
            null,
        ];

        // Then - one per reason beside a setting, one per name mapped to its reason, none elsewhere
        expect(cases.map((written) => exceptionsIn(written))).toStrictEqual([
            1, 1, 2, 1, 1, 0, 0, 0,
        ]);
    });
});
