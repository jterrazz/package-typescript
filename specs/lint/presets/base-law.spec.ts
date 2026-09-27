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

    test('refuses each of the six laws at its import, and lets the self catalogue read the consumer one and a catalogue test read what it audits', async () => {
        // Given - a lint/ tree breaking each law once, beside the two edges the catalogue law allows
        const result = await lint.fixture(directory('./_fixtures/every-law/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/consumer/catalogue/rows.ts:1:22  architecture(catalogue-at-the-bottom)
                found: \`lint/consumer/catalogue/rows.ts\` imports \`lint/consumer/rules/rule.ts\`
                why: a catalogue is data at the bottom of the arrow — it reads engine/ and, for the self catalogue, the consumer catalogue it extends; its tests audit what it catalogues
                fix: move what the catalogue needs into engine/
                read: docs/01-architecture.md#the-judging-layer
            lint/consumer/rules/rule.ts:1:23  architecture(consumer-folders-apart)
                found: \`lint/consumer/rules/rule.ts\` imports \`lint/consumer/checks/check.ts\`
                why: a consumer declaration reads the catalogue and engine/, never a sibling folder
                fix: move what both folders need into the catalogue or into engine/
                read: docs/01-architecture.md#the-judging-layer
            lint/engine/project/reader.ts:1:22  architecture(engine-knows-no-declaration)
                found: \`lint/engine/project/reader.ts\` imports \`lint/consumer/rules/rule.ts\`
                why: lint/engine/ runs declarations and knows none — it receives them from an index, which it never imports
                fix: hand the declaration to engine/ from an index, never import it from engine/
                read: docs/01-architecture.md#the-judging-layer
            lint/index.ts:1:25  architecture(shipped-lint-reads-no-self)
                found: \`lint/index.ts\` imports \`src/command.ts\`
                why: the shipped lint/ never reads self/ (never shipped) nor src/ (the command)
                fix: move what the shipped code needs out of self/ and src/ into engine/
                read: docs/01-architecture.md#the-judging-layer
            lint/self/checks/audit.ts:1:23  architecture(self-folders-apart)
                found: \`lint/self/checks/audit.ts\` imports \`lint/self/corpus/words.ts\`
                why: a self declaration reads its catalogue, consumer/, engine/ and src/, never a sibling folder
                fix: move what both folders need into the catalogue or into engine/
                read: docs/01-architecture.md#the-judging-layer
            src/app.ts:1:23  architecture(src-reads-no-declaration)
                found: \`src/app.ts\` imports \`lint/consumer/checks/check.ts\`
                why: src/ runs what lint/ declares through its index files and engine/, never a declaration of consumer/ or self/
                fix: move what src/ needs into engine/, or compose it in a \`lint/\` index, and import it from there
                read: docs/01-architecture.md#the-judging-layer
        `);
    });
});
