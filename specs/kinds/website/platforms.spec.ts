import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('platforms', () => {
    test('a website on next fixes, checks and tests from its declaration alone', async () => {
        // Given - a Next.js site, which its framework builds, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/website-next/'))
            .exec(['typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/next"',
        );
    });

    test('a website on astro fixes, checks and tests from its declaration alone', async () => {
        // Given - an Astro site, which its framework builds, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/website-astro/'))
            .exec(['typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/astro"',
        );
    });

    test('a website on browser fixes, checks and tests from its declaration alone', async () => {
        // Given - a bundled site of plain DOM code, which its bundler builds, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/website-browser/'))
            .exec(['typescript fix', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/browser"',
        );
    });
});
