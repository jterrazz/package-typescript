import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('greet', () => {
    test('greets the name it is given', async () => {
        // Given - a name on the command line
        const result = await cli.exec('Ada');

        // Then - the greeting carries it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Hello, Ada.
        `);
    });
});
