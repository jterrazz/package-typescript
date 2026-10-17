import { describe, expect, test } from 'vitest';

import { cli as strictInstallCli } from '../strict-install.specification.js';

describe('strict-install', () => {
    test('loads the documented configs where only @jterrazz/typescript is declared', async () => {
        // Given - a pnpm-strict install: nothing the consumer did not declare resolves from its root
        const result = await strictInstallCli.exec();

        // Then - the sandbox is strict, and both configs still load, since a config imports the package alone
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('unreachable from the consumer root: oxlint');
        expect(result.stdout.text).toContain('unreachable from the consumer root: oxfmt');
        expect(result.stdout.text).toContain('loaded: oxlint.config.ts');
        expect(result.stdout.text).toContain('loaded: oxfmt.config.ts');
    });
});
