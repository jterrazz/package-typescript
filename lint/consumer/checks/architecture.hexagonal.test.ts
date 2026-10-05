import { describe, expect, test } from 'vitest';

import { PLATFORMS } from '../../kit/project/project-kind.js';
import type { Platform } from '../../kit/project/project-kind.js';
import { compositionEntriesOf } from './architecture.hexagonal.js';

const CANDIDATES = [
    'app/_layout.tsx',
    'app/layout.tsx',
    'pages/_app.tsx',
    'src/app/_layout.tsx',
    'src/app/layout.tsx',
    'src/index.ts',
    'src/main.tsx',
    'src/middleware.ts',
    'src/pages/_app.tsx',
];

/** The candidate modules a platform's entry paths match. */
function entriesOf(platform: null | Platform): string[] {
    const entries = compositionEntriesOf(platform).map((path) => new RegExp(path, 'u'));

    return CANDIDATES.filter((candidate) => entries.some((pattern) => pattern.test(candidate)));
}

describe('architecture.hexagonal', () => {
    test('hexagonalRules — the composition root is entered where each platform enters an app', () => {
        // Given - every platform a project may declare
        // Then - a process by src/index, a UI app by its root layout, page or middleware
        expect(
            Object.fromEntries(PLATFORMS.map((platform) => [platform, entriesOf(platform)])),
        ).toStrictEqual({
            astro: ['src/middleware.ts'],
            bun: ['src/index.ts'],
            expo: ['app/_layout.tsx', 'src/app/_layout.tsx'],
            next: ['app/layout.tsx', 'pages/_app.tsx', 'src/app/layout.tsx', 'src/pages/_app.tsx'],
            node: ['src/index.ts'],
            react: ['src/index.ts', 'src/main.tsx'],
        });
    });

    test('hexagonalRules — an undeclared platform enters by src/index', () => {
        // Given - a project that declares no platform
        // Then - it is entered as a process is
        expect(entriesOf(null)).toStrictEqual(['src/index.ts']);
    });
});
