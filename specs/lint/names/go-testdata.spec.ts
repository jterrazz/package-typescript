import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('go-testdata', () => {
    test('passes the golden trees a Go module keeps in testdata/ beside its code, however their folders and files are named', async () => {
        // Given - a module holding a go.mod, and testdata/ folders with names the tree law would refuse anywhere else, in src/ and in a folder of a root that is no spine
        const result = await lint.fixture(directory('./__fixtures__/go-testdata/')).run();

        // Then - the go tool's ground is no file of the sweep, so nothing is reported
        expect(result.report).toMatch('');
    });
});
