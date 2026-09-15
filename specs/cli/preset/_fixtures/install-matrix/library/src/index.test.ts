import { expect, test } from 'vitest';

import { greet } from './index.js';

/*
 * The A4 idiom of @jterrazz/test: a specification is awaited at the top level
 * of a spec and destructured into a handle and its cleanup.
 * `isolatedDeclarations` refused that export (TS9019), which is why the
 * guarantee it buys lives in the bundle preset and not in this profile's
 * tsconfig ([Developing](../../../../../../docs/02-developing.md)).
 */
export const { cleanup, name } = await Promise.resolve({
    cleanup: (): null => null,
    name: 'world',
});

test('greets by name', () => {
    // Given - a name
    // Then - the greeting carries it
    expect(greet(name)).toBe('hello world');
    cleanup();
});
