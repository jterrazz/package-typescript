import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

// outside: the watch stream is cut wherever its waitFor marker lands, so there is no byte-exact stdout to state.

describe('watch', () => {
    test('rebuilds on change and runs nothing', async () => {
        // Given - a sample app that prints a line when it runs, built in watch mode and resolved once the first build completes
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .exec('build --watch', { timeout: 15_000, waitFor: 'Rebuilt in' });

        // Then - the entry is built, and the app it holds was not started
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('dist/index.js');
        expect(result.stdout.text).not.toContain('Hello from sample app');
    });
});
