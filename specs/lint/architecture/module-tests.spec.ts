import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('module tests', () => {
    test('lets a module test wire an adapter and the composition root, and still refuses the module it tests', async () => {
        // Given - a hexagonal tree whose module tests import infrastructure/ and composition/, and whose domain imports infrastructure/ itself
        const result = await lint.fixture(directory('./__fixtures__/module-tests/')).run();

        // Then - the domain module's crossing alone is refused
        expect(result.report).toMatch(`
            src/domain/user.ts:1:22  architecture(hexagonal-domain-is-pure)
                found: \`src/domain/user.ts\` imports \`src/infrastructure/db.ts\`
                why: the domain layer is pure: it imports no other layer
                fix: move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it
                read: docs/reference/quality-checks.md#the-hexagonal-map
        `);
    });
});
