import { expect, test } from 'vitest';

import { cli as strictInstallCli } from '../strict-install.specification.js';

/*
 * A chain, not a document: the sandbox runner constructs its own install tree,
 * and `literate()` binds every document of this repo to the product command.
 */

test('loads the documented configs where only @jterrazz/typescript is declared', async () => {
    // Given - a pnpm-strict install: nothing the consumer did not declare resolves from its root
    const result = await strictInstallCli.exec();

    // Then - the sandbox is strict, and both configs still load — a config imports the package alone
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('unreachable from the consumer root: oxlint');
    expect(result.stdout).toContain('unreachable from the consumer root: oxfmt');
    expect(result.stdout).toContain('loaded: oxlint.config.ts');
    expect(result.stdout).toContain('loaded: oxfmt.config.ts');
});
