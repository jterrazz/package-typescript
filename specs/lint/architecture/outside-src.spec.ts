import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('outside-src', () => {
    test('judges a map in a top-level folder other than src', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/outside-src/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            app/domain/user.ts:1:22  architecture(hexagonal-domain-is-pure)
                found: \`app/domain/user.ts\` imports \`app/infrastructure/db.ts\`
                why: the domain layer is pure — it imports no other layer
                fix: move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it
                read: docs/06-quality-checks.md#the-hexagonal-map
        `);
    });
});
