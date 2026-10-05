import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('derived', () => {
    test('holds a tree laid out as a hexagonal application to the hexagonal map, declared or not', async () => {
        // Given - src/ holding domain/, application/ and infrastructure/, no settings file, and the domain importing the infrastructure
        const result = await lint.fixture(directory('./_fixtures/laid-out/')).run();

        // Then - the crossing is refused as the declared map refuses it
        expect(result.report).toMatch(`
            src/domain/user.ts:1:22  architecture(hexagonal-domain-is-pure)
                found: \`src/domain/user.ts\` imports \`src/infrastructure/db.ts\`
                why: the domain layer is pure — it imports no other layer
                fix: move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it
                read: docs/reference/quality-checks.md#the-hexagonal-map
        `);
    });

    test('leaves the same tree alone once its settings write the map off', async () => {
        // Given - the same tree, its settings writing `hexagonal: false`
        const result = await lint.fixture(directory('./_fixtures/laid-out-opted-out/')).run();

        // Then - nothing is refused
        expect(result.report).toMatch('');
    });
});
