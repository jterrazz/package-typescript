import { expect, test } from 'vitest';

import { PACKAGE_ROOT, cli as resolutionCli } from '../resolution.specification.js';

test('resolves each tool independently when npm splits them between bin dirs', async () => {
    // Given - oxlint nested under the package, the other tools hoisted to the consumer root
    const result = await resolutionCli.exec(PACKAGE_ROOT);

    // Then - the whole check output matches: every tool is found and runs, wherever npm placed it
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('resolution.txt');
});
