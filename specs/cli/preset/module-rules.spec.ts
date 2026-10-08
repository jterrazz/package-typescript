import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../__setup__/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

const NODE_CONFIG = profilePath('node');

describe('module-rules', () => {
    test('a data module holding logic and an errors module holding a second family are each refused with their lesson', async () => {
        // Given - a data module exporting a lookup beside its rows, and an errors module holding a class outside its family
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/module-rules/'))
            .exec(`-c ${NODE_CONFIG} projects.data.ts runtime/errors.ts`);

        // Then - each finding states what it found, why, how to fix it, and where to read
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('jterrazz-typescript(')).toMatch(`
            runtime/errors.ts:9:8: error jterrazz-typescript(error-family-shares-its-base): found: class \`Ledger\` derives from no class of this module, beside the base \`RuntimeError\` · why: an errors module is exempt from max-classes-per-file because its classes are one vocabulary — a base and what derives from it — and a class outside that family is a second subject the cap no longer reads · fix: derive the class from the family’s base declared in this module, or move it to a module of its own · read: docs/reference/lint-presets.md#an-errors-module-holds-one-family
            projects.data.ts:3:29: error jterrazz-typescript(data-module-holds-data): found: a \`ArrowFunctionExpression\` in a data module · why: a data module is exempt from the file-size cap because rows are not logic — a function, a class or a statement in one is logic the cap no longer reads · fix: move the logic into a module of its own that imports the table; a \`*.data.ts\` module keeps its imports, its types and the literals it exports · read: docs/reference/lint-presets.md#a-data-module-holds-data
            projects.data.ts:3:70: error jterrazz-typescript(data-module-holds-data): found: a \`ArrowFunctionExpression\` in a data module · why: a data module is exempt from the file-size cap because rows are not logic — a function, a class or a statement in one is logic the cap no longer reads · fix: move the logic into a module of its own that imports the table; a \`*.data.ts\` module keeps its imports, its types and the literals it exports · read: docs/reference/lint-presets.md#a-data-module-holds-data
        `);
    });
});
