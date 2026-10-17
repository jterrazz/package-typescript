import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../kinds.specification.js';

describe('platforms', () => {
    test('a library on bun fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library on bun, its types the runtime declares, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-bun/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/bun"',
        );
    });

    test('a library on react fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library of React components, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-react/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/react"',
        );
    });

    test('a library on next fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library of components for a Next.js host, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-next/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/next"',
        );
    });

    test('a library on astro fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library of components for an Astro host, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-astro/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/astro"',
        );
    });

    test('a library on expo fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library of components for an Expo app, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-expo/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/expo"',
        );
    });

    test('a library on browser fixes, builds, checks and tests from its declaration alone', async () => {
        // Given - a library of plain DOM code, both packed packages installed
        const result = await cli
            .fixture(directory('./__fixtures__/library-browser/'))
            .exec(['typescript fix', 'typescript build', 'typescript check', 'vitest --run']);

        // Then - every gesture passes, and the editor files derive from what it declares
        expect(result.exitCode).toBe(0);
        expect(result.file('tsconfig.json').content).toContain(
            '"extends": "@jterrazz/typescript/tsconfig/browser"',
        );
    });
});
