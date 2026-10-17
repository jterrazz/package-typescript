import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../preset-lint.specification.js';

describe('base-law', () => {
    test('holds a lint/ tree to the base preset alone, refusing each of its six laws at its import, and lets through each edge a law allows', async () => {
        // Given - a lint/ tree breaking each law once, beside the edges the laws allow: the self catalogue reading the consumer one, a catalogue test reading what it audits, a rule test reading src/
        const result = await lint.fixture(directory('./__fixtures__/every-law/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/consumer/catalogue/rows.ts:1:22  architecture(catalogue-at-the-bottom)
                found: \`lint/consumer/catalogue/rows.ts\` imports \`lint/consumer/rules/rule.ts\`
                why: a catalogue is data at the bottom of the arrow — it reads kit/, the package’s standard and, for the self catalogue, the consumer catalogue it extends; its tests audit what it catalogues
                fix: move what the catalogue needs into kit/
                read: docs/concepts/architecture.md#the-judging-layer
            lint/consumer/rules/rule.ts:1:23  architecture(consumer-folders-apart)
                found: \`lint/consumer/rules/rule.ts\` imports \`lint/consumer/checks/check.ts\`
                why: a consumer declaration reads the catalogue and kit/, never a sibling folder
                fix: move what both folders need into the catalogue or into kit/
                read: docs/concepts/architecture.md#the-judging-layer
            lint/index.ts:1:25  architecture(shipped-lint-reads-no-self)
                found: \`lint/index.ts\` imports \`src/command.ts\`
                why: the shipped lint/ never reads self/ (never shipped) nor src/ (the command) — only src/standard/, the data both apply; its tests are not shipped, and may run a rule through the package that ships it
                fix: move what the shipped code needs out of self/ and src/ into kit/, or into src/standard/ when it is a default the package holds projects to
                read: docs/concepts/architecture.md#the-judging-layer
            lint/kit/project/reader.ts:1:22  architecture(kit-knows-no-declaration)
                found: \`lint/kit/project/reader.ts\` imports \`lint/consumer/rules/rule.ts\`
                why: lint/kit/ runs declarations and knows none — it receives them from a module at the root of lint/, which it never imports
                fix: hand the declaration to kit/ from a module at the root of lint/, never import it from kit/
                read: docs/concepts/architecture.md#the-judging-layer
            lint/self/checks/audit.ts:1:23  architecture(self-folders-apart)
                found: \`lint/self/checks/audit.ts\` imports \`lint/self/corpus/words.ts\`
                why: a self declaration reads its catalogue, consumer/, kit/ and src/, never a sibling folder
                fix: move what both folders need into the catalogue or into kit/
                read: docs/concepts/architecture.md#the-judging-layer
            src/app.ts:1:23  architecture(src-reads-no-declaration)
                found: \`src/app.ts\` imports \`lint/consumer/checks/check.ts\`
                why: src/ runs what lint/ declares through the modules at the root of lint/ and kit/, never a declaration of consumer/ or self/
                fix: move what src/ needs into kit/, or compose it in a module at the root of \`lint/\`, and import it from there
                read: docs/concepts/architecture.md#the-judging-layer
        `);
    });
});
