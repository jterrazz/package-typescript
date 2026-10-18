import { describe, expect, test } from 'vitest';

import { cli as freshCloneCli } from '../fresh-clone.specification.js';

describe('fresh-clone-unresolved', () => {
    test('refuses to build a clone whose settings file exports no settings, and builds nothing', async () => {
        // Given - a fresh clone whose jterrazz.config.ts exports a number
        const result = await freshCloneCli.exec('unresolved');

        // Then - the bootstrap refuses as `typescript build` does, before tsdown writes dist/
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain(
            'found: jterrazz.config.ts exports no settings object as its default',
        );
        expect(result.stdout.text).toContain('built nothing');
    });
});
