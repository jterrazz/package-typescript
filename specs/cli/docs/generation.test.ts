import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * The generation itself — the command, its exit code and everything it printed —
 * is stated in projection.spec.yaml, and running it here asserts all of that.
 * What stays in code is the pair of claims the document has no vocabulary for: a
 * byte-exact snapshot of the whole generated tree, and a file list that is
 * EXACTLY what typedoc emitted (`files:` names what must be there, never what
 * must not).
 */

test('leaves a committed docs tree that matches byte for byte', async () => {
    // Given - the whole generation, stated in the document
    const result = await cli.run('projection.spec.yaml');

    // Then - the committed docs/ tree matches byte-for-byte (reference tree + chapters)
    await expect(result.directory('docs')).toMatch('docs');
});

test('emits the full reference member set including enumerations', async () => {
    // Given - the same generation
    const result = await cli.run('projection.spec.yaml');

    // Then - typedoc's member tree carries every category, enumerations included
    const files = await result.directory('docs/reference').files();
    expect(files).toEqual([
        'enumerations/Level.md',
        'functions/add.md',
        'functions/greet.md',
        'index.md',
        'type-aliases/User.md',
        'variables/VERSION.md',
    ]);
});
