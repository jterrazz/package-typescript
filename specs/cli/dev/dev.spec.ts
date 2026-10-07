import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

// outside: the watch stream is cut wherever its waitFor marker lands, so there is no byte-exact stdout to state.

describe('dev', () => {
    test('shows the startup message', async () => {
        // Given - dev mode on a sample app, resolved once the banner appears
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .exec('dev', { timeout: 10_000, waitFor: 'Starting dev mode' });

        // Then - the banner and startup message appear
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('TYPESCRIPT');
        expect(result.stdout.text).toContain('Starting dev mode');
    });

    test('builds and runs the app in watch mode', async () => {
        // Given - dev mode on a sample app, resolved once the app output appears
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .exec('dev', { timeout: 15_000, waitFor: 'Hello from sample app' });

        // Then - the app output appears (the build succeeded and the app ran)
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Hello from sample app');
    });
});
