import { describe, expect, test } from 'vitest';

import { spec } from '../../setup/cli.specification.js';

describe('start', () => {
    test('runs the built application', async () => {
        // Given — build first, then start in the same directory
        const result = await spec('build+start')
            .project('sample-app')
            .exec(['build', 'start'])
            .run();

        // Then — app runs and prints its message
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Hello from sample app');
    });

    test('fails if dist does not exist', async () => {
        // Given — empty project, no build step
        const result = await spec('no dist').project('sample-app').exec('start').run();

        // Then — exits with error
        expect(result.exitCode).toBe(1);
    });
});
