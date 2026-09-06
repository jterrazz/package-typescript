import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * A projection is compiled from a PACKAGE's own barrel, against its own tsconfig,
 * into its own docs/ — three things a workspace root does not have and each member
 * does. `typescript docs` at a workspace root therefore compiles once per member
 * that owns a projection, not once for the root that owns none.
 *
 * The run and what it printed are workspace-members.spec.yaml's. Only the exact
 * member trees stay here: `files:` can require a path, never forbid the ones
 * nobody listed.
 */

test('gives every member that owns a projection its own reference tree', async () => {
    // Given - the whole generation over a two-package workspace, stated in the document
    const result = await cli.run('workspace-members.spec.yaml');

    // Then - each member's reference tree holds exactly what its barrel exports
    expect(await result.directory('packages/lib-a/docs/reference').files()).toEqual([
        'functions/greet.md',
        'index.md',
    ]);
    expect(await result.directory('packages/lib-b/docs/reference').files()).toEqual([
        'index.md',
        'variables/VERSION.md',
    ]);
});
