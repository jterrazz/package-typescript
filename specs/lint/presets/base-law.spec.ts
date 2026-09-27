import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../presets-lint.specification.js';

describe('base-law', () => {
    test('holds a lint/ tree to the direction the base preset carries, with no settings file', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/base-law/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            src/app.ts:1:25  architecture(src-reads-no-declaration)
                found: \`src/app.ts\` imports \`lint/self/audit.ts\`
                why: src/ runs what lint/ declares through its index files and engine/, never a declaration of consumer/ or self/
                fix: move what src/ needs into engine/, or compose it in a \`lint/\` index, and import it from there
                read: docs/01-architecture.md#the-judging-layer
        `);
    });
});
