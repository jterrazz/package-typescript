import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('crossed', () => {
    test('fails a module graph that crosses the layer map the project declared', async () => {
        // Given - a module graph importing across the declared layers
        const result = await lint.fixture(directory('./_fixtures/crossed/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            src/domain/user.ts:1:22  architecture(domain-stays-pure)
                found: \`src/domain/user.ts\` imports \`src/infrastructure/store.ts\`
                why: A domain module never reaches for infrastructure.
                fix: reach it through a layer the map allows, or change the map where the boundary moved
                read: docs/07-quality-checks.md#the-architecture-layer-map-pass
        `);
    });
});
