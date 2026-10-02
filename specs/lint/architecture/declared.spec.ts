import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('declared', () => {
    test('fails the hexagonal map and a layer of its own at each import, type-only ones included', async () => {
        // Given - the hexagonal map and a layer of its own, crossed by value and type-only imports
        const result = await lint.fixture(directory('./_fixtures/declared/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            src/domain/customer.ts:1:26  architecture(hexagonal-domain-is-pure)
                found: \`src/domain/customer.ts\` imports \`src/infrastructure/outbound/row.ts\`
                why: the domain layer is pure — it imports no other layer
                fix: move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it
                read: docs/07-quality-checks.md#the-hexagonal-map
            src/domain/order.ts:1:27  architecture(hexagonal-domain-is-pure)
                found: \`src/domain/order.ts\` imports \`src/infrastructure/outbound/orders.ts\`
                why: the domain layer is pure — it imports no other layer
                fix: move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it
                read: docs/07-quality-checks.md#the-hexagonal-map
            src/handlers/orders.ts:2:24  architecture(handlers-reach-services)
                found: \`src/handlers/orders.ts\` imports \`src/store/orders.ts\`
                why: a handler speaks HTTP and hands the work to a service
                fix: read the order through the service, which owns the store
                read: docs/01-architecture.md#layers
            src/presentation/features/articles/card.ts:3:24  architecture(hexagonal-feature-is-independent)
                found: \`src/presentation/features/articles/card.ts\` imports \`src/presentation/features/quiz/sheet.ts\`
                why: a feature is independent — shared code lives in features/common
                fix: move what two features share into \`presentation/features/common/\`
                read: docs/07-quality-checks.md#the-hexagonal-map
        `);
    });
});
