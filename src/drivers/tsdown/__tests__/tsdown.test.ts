import { describe, expect, test } from 'vitest';

import { watchArguments } from '../tsdown.js';

describe('tsdown', () => {
    test('watchArguments — watches the config and the project, and starts the application only when it is asked to', () => {
        // Given - the same config and project, asked to run the application and not
        const quiet = watchArguments('/tmp/tsdown.config.mjs', '/work/app', false);
        const running = watchArguments('/tmp/tsdown.config.mjs', '/work/app', true);

        // Then - both watch, in this order; only the second carries the command that starts the build
        expect([quiet, running]).toStrictEqual([
            ['--config', '/tmp/tsdown.config.mjs', '--cwd', '/work/app', '--watch'],
            [
                '--config',
                '/tmp/tsdown.config.mjs',
                '--cwd',
                '/work/app',
                '--watch',
                '--on-success',
                'node --enable-source-maps dist/index.js',
            ],
        ]);
    });
});
