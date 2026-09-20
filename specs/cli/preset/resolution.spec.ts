import { expect, test } from 'vitest';

import { PACKAGE_ROOT, cli as resolutionCli } from '../resolution.specification.js';

/*
 * A chain, not a document: the sandbox runner takes this checkout's absolute path
 * as its argument, and a document's `command:` is fixed text — nothing there can
 * name a path that moves with the machine.
 */

test('resolves each tool independently when npm splits them between bin dirs', async () => {
    // Given - oxlint nested under the package, the other tools hoisted to the consumer root
    const result = await resolutionCli.exec(PACKAGE_ROOT);

    // Then - the whole check output matches: every tool is found and runs, wherever npm placed it
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('resolution.txt');
});
