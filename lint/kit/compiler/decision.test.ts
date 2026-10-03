import { describe, expect, test } from 'vitest';

import { compile } from './compile.js';
import { fragment, off, on, typeAware } from './decision.js';

const REASON = { by: 'oxfmt sortImports', kind: 'covered' } as const;

describe('decision', () => {
    test('gives every decision the fragment version, unless it carries its own', () => {
        // Given - a fragment born in one version with one decision taken later
        const probe = fragment({
            audience: 'consumer',
            id: 'probe',
            rules: { curly: on(), 'no-var': off(REASON, '10.2.0') },
            since: '10.0.0',
        });

        // Then - each decision states when it was taken
        expect(probe.decisions.curly?.since).toBe('10.0.0');
        expect(probe.decisions['no-var']?.since).toBe('10.2.0');
    });

    test('compiles a fragment to a plain oxlint config, and never to a category', () => {
        // Given - a fragment with an option, a type-aware rule and an off
        const probe = fragment({
            audience: 'consumer',
            id: 'probe',
            plugins: ['typescript'],
            rules: {
                curly: on(),
                'max-depth': on([4]),
                'no-var': off(REASON),
                'typescript/await-thenable': typeAware(),
            },
        });

        // Then - the config states every level by name
        expect(compile(probe)).toStrictEqual({
            plugins: ['typescript'],
            rules: {
                curly: 'error',
                'max-depth': ['error', 4],
                'no-var': 'off',
                'typescript/await-thenable': 'error',
            },
        });
    });
});
