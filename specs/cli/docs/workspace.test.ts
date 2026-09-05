import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * A projection is compiled from a PACKAGE's own barrel, against its own tsconfig,
 * into its own docs/ — three things a workspace root does not have and each member
 * does. `typescript docs` at a workspace root therefore compiles once per member
 * that owns a projection, not once for the root that owns none.
 */

test('compiles a projection for every member that owns one', async () => {
    // Given - a workspace root with no barrel of its own and two documented packages
    const result = await cli.fixture('workspace-packages/').exec('docs');

    // Then - each member is named and gets its own reference tree
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('packages/lib-a');
    expect(result.stdout).toContain('packages/lib-b');
    expect(await result.directory('packages/lib-a/docs/reference').files()).toEqual([
        'functions/greet.md',
        'index.md',
    ]);
    expect(await result.directory('packages/lib-b/docs/reference').files()).toEqual([
        'index.md',
        'variables/VERSION.md',
    ]);
});

test('checks every member projection it generated', async () => {
    // Given - a workspace generated and then checked in the same tree
    const result = await cli.fixture('workspace-packages/').exec(['docs', 'docs --check']);

    // Then - the sync check is green for the whole workspace
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Docs are in sync');
});
