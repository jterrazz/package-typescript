import { describe, expect, test } from 'vitest';

import { PLATFORMS } from '../../../kit/project/project-kind.js';
import type { Platform } from '../../../kit/project/project-kind.js';
import { compositionEntriesOf, hexagonalRules } from '../architecture.hexagonal.js';

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
            browser: ['src/index.ts', 'src/main.tsx'],
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

    test('every rule of the map says why it holds, in the words its finding prints', () => {
        // Given - the map a node project is held to
        // Then - each rule carries its reason
        expect(
            Object.fromEntries(hexagonalRules('node').map((rule) => [rule.name, rule.why])),
        ).toStrictEqual({
            'hexagonal-composition-is-the-root':
                'the composition root builds the app once, for the app entry and for a spec runner; a module that reached it would depend on the whole graph',
            'hexagonal-composition-wires-infrastructure':
                '`composition/` is the one layer that builds an implementation and hands it to the application',
            'hexagonal-domain-is-pure': 'the domain layer is pure: it imports no other layer',
            'hexagonal-feature-is-independent':
                'a feature is independent: shared code lives in features/common',
            'hexagonal-inbound-injects-outbound':
                'an inbound adapter reaches an outbound one through injection, not by import',
            'hexagonal-port-knows-no-implementation':
                'a port is an interface: it cannot depend on what implements it',
            'hexagonal-ui-stays-pure':
                'an atom and a molecule are pure, and navigation is a feature concern',
            'hexagonal-use-case-reaches-ports':
                'a use case depends on the domain and on ports, never on an implementation',
        });
    });
});
