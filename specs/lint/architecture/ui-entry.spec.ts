import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../architecture-lint.specification.js';

describe('ui-entry', () => {
    test("ui entry — lets an Expo app's root layout reach the composition root, and refuses a hook and `src/index` that reach it", async () => {
        // Given - an Expo app whose root layout composes the app, and a hook and a `src/index` that compose it too
        const result = await lint.fixture(directory('./__fixtures__/ui-entry/')).run();

        // Then - the hook and `src/index` refused, the root layout let through
        expect(result.report).toMatch(`
            src/index.ts:1:25  architecture(hexagonal-composition-is-the-root)
                found: \`src/index.ts\` imports \`src/composition/compose.ts\`
                why: the composition root builds the app once, for the app entry and for a spec runner; a module that reached it would depend on the whole graph
                fix: take what it needs as an argument, and let the app entry or the spec runner call \`compose()\` and hand it down
                read: docs/reference/quality-checks.md#the-hexagonal-map
            src/presentation/features/articles/use-articles.ts:1:25  architecture(hexagonal-composition-is-the-root)
                found: \`src/presentation/features/articles/use-articles.ts\` imports \`src/composition/compose.ts\`
                why: the composition root builds the app once, for the app entry and for a spec runner; a module that reached it would depend on the whole graph
                fix: take what it needs as an argument, and let the app entry or the spec runner call \`compose()\` and hand it down
                read: docs/reference/quality-checks.md#the-hexagonal-map
        `);
    });
});
