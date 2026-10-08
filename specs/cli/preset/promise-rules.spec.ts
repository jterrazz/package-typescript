import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../__setup__/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

const NODE_CONFIG = profilePath('node');

describe('promise-rules', () => {
    test("a promise chain and an async function wrapped at the top level are refused, and a schema's fallback is not", async () => {
        // Given - a module holding a zod-shaped `.catch('en')`, a top-level `.then()` chain and an async IIFE
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/promise-rules/'))
            .exec(`-c ${NODE_CONFIG} schemas.ts`);

        // Then - the chain and the IIFE are each refused with their lesson, and the fallback is silent
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('jterrazz-typescript(')).toMatch(`
            schemas.ts:6:24: error jterrazz-typescript(promise-is-awaited): found: a \`.then()\` chain where \`await\` reads the promise · why: the estate writes \`await\`: a promise read top to bottom, its failure caught where a \`try\` says so, never a chain of callbacks threading the value through · fix: await the promise, inside a \`try\`/\`catch\` for its failure; a call that only shares the name — a zod schema’s \`.catch(fallback)\` — is read as no promise when the schema is built from zod’s import in the file, or when its fallback is a value: a literal, a constant named in capitals (\`DEFAULT_LANGUAGE\`, \`Language.En\`), or a \`const\` naming one · read: docs/reference/lint-presets.md#a-promise-is-awaited
            schemas.ts:8:1: error jterrazz-typescript(promise-is-awaited): found: an async function called where it is declared, at the module’s top level · why: the estate writes \`await\`: a promise read top to bottom, its failure caught where a \`try\` says so, never a chain of callbacks threading the value through · fix: await at the module’s top level: an ES module awaits there, with no function to wrap it · read: docs/reference/lint-presets.md#a-promise-is-awaited
        `);
    });
});
