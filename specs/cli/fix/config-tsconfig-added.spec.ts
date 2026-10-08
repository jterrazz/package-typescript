import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

describe('config-tsconfig-added', () => {
    test("writes what the project adds beside its preset's file set, and type-checks both", async () => {
        // Given - a library adding a scripts glob and an ambient file to its tsconfig, its source holding one type error
        const result = await cli
            .with({ env: onlyPasses('config', 'typescript') })
            .fixture(directory('./__fixtures__/config/tsconfig-added/'))
            .exec(['fix', 'check']);

        // Then - the preset's globs stay beside the added one, the ambient file is named, and the source is still checked
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.file('tsconfig.json').content)).toStrictEqual({
            extends: '@jterrazz/typescript/tsconfig/node',
            files: ['types/ambient.d.ts'],
            include: [
                `\${configDir}/**/*.ts`,
                `\${configDir}/**/*.tsx`,
                `\${configDir}/**/*.js`,
                'scripts/**/*.mts',
            ],
        });
        expect(result.stdout).toMatch(
            `{{any}}src/index.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.{{any}}`,
        );
    });
});
