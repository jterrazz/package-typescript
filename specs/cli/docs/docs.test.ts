import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('generates API docs for a library', async () => {
    // Given - a sample library project with a documented public API
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('docs');

    // Then - the docs generation succeeds, emits llms.txt, and the whole stdout matches (volatile temp paths tokenized)
    expect(result.exitCode).toBe(0);
    expect(result.file('.docs/llms.txt').exists).toBe(true);
    expect(result.stdout).toMatch('docs.txt');
});
