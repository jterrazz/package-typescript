import { expect, test } from 'vitest';

import { fragment, off, on, REASON_KINDS, typeAware } from './_contract.js';
import { compile } from './compile.js';

/*
 * The two invariants every fragment of the rulebook rests on: a decision is
 * `error` or `off` and never `warn`, and an `off` carries exactly one of the
 * five recorded reasons. Both are enforced at LOAD time, so a fragment that
 * breaks one cannot be imported at all.
 */

const REASON = { by: 'oxfmt sortImports', kind: 'covered' } as const;

test('refuses an off with no reason', () => {
    // Given - a decision turned off on nobody's authority
    // Then - the contract refuses it before any config is built
    expect(() => off()).toThrow(/needs a reason/u);
});

test('refuses a reason whose kind is not one of the five', () => {
    // Given - a reason invented on the spot
    // Then - the contract names the five and refuses the sixth
    expect(() => off({ by: 'taste', kind: 'too-strict' })).toThrow(/Unknown reason kind/u);
    expect(REASON_KINDS).toHaveLength(5);
});

test('refuses a reason that names nothing', () => {
    // Given - a kind with no rule, page or measurement behind it
    // Then - "covered" has to say by what
    expect(() => off({ by: '', kind: 'covered' })).toThrow(/must name what carries it/u);
});

/** A fragment reaching for the warning tier this rulebook does not have. */
function buildWarningFragment() {
    return fragment({ id: 'probe', rules: { curly: { level: 'warn' } } });
}

test('refuses a level that is neither error nor off', () => {
    // Given - a fragment reaching for a warning tier
    // Then - there is no warn in this rulebook
    expect(buildWarningFragment).toThrow(/a rule is error or off/u);
});

test('gives every decision the fragment version, unless it carries its own', () => {
    // Given - a fragment born in one version with one decision taken later
    const probe = fragment({
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
