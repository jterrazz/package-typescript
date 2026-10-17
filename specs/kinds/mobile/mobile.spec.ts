import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('mobile', () => {
    test('a mobile app builds, fixes, checks and tests from its declaration alone', async () => {
        // Given - an expo app, its screens under app/, its main naming the router's entry, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/mobile/'))
            .exec(['typescript build', 'typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, the build leaves the bundle to Metro and writes no dist/, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('dist').exists).toBe(false);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/expo"',
        );
    });

    test('a mobile app builds nothing a package build compiles, and says so', async () => {
        // Given - the same app
        const result = await cli
            .fixture(directory('./__fixtures__/mobile/'))
            .exec('typescript build');

        // Then - the note, and no dist/
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Building the entries the manifest publishes...

            Nothing to build: a mobile app is bundled by its framework (\`npx expo export\`) and publishes nothing a package build compiles
        `);
        expect(result.file('dist').exists).toBe(false);
    });
});
