import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { lintFragments } from '../specs/surface/package/lint-fragments.js';
import { fragment, off, on, REASON_KINDS, typeAware, unsafeFix } from './_contract.js';
import { compile } from './compile.js';

/*
 * The two invariants every fragment of the rulebook rests on: a decision is
 * `error` or `off` and never `warn`, and an `off` carries exactly one of the
 * five recorded reasons. They judge this package's own fragments alone —
 * `fragment()` is not exported — so they are `self` rules: the contract ships
 * without them, and this suite audits every fragment a module of `lint/` or
 * `src/` exports, by default or by name, whether a profile carries it or not.
 */

const REASON = { by: 'oxfmt sortImports', kind: 'covered' } as const;

/** A value whose keys the audit reads. */
type Loose = Record<string, unknown>;

/** Whether a value is an object whose keys can be read. */
function isRecord(value: unknown): value is Loose {
    return typeof value === 'object' && value !== null;
}

/** What an `off`'s reason lacks, if anything. */
function reasonProblem(reason: unknown): string | undefined {
    if (!isRecord(reason) || Object.keys(reason).length === 0) {
        return 'is off with no reason';
    }
    if (typeof reason.kind !== 'string' || !REASON_KINDS.includes(reason.kind)) {
        return 'is off for a reason of no known kind';
    }
    if (typeof reason.by !== 'string' || reason.by === '') {
        return 'has a reason that names nothing';
    }
    return undefined;
}

/** What one decision owes the contract, as the problems it has. */
function decisionProblems(decision: unknown): string[] {
    if (!isRecord(decision)) {
        return ['is not a decision — use on(), typeAware() or off()'];
    }
    if (decision.level !== 'error' && decision.level !== 'off') {
        return [`is "${String(decision.level)}" — a rule is error or off`];
    }
    const unexplained =
        decision.fixer !== undefined &&
        (typeof decision.fixerReason !== 'string' || decision.fixerReason === '');

    return [
        decision.level === 'off' ? reasonProblem(decision.reason) : undefined,
        unexplained ? 'marks an unsafe fixer without saying what it changes' : undefined,
    ].filter((problem) => problem !== undefined);
}

/** A fragment's decision blocks: its own body, then each override's. */
function blocksOf(one: Loose): Loose[] {
    const overrides: readonly unknown[] = Array.isArray(one.overrides) ? one.overrides : [];

    return [
        isRecord(one.decisions) ? one.decisions : {},
        ...overrides.map((override) =>
            isRecord(override) && isRecord(override.decisions) ? override.decisions : {},
        ),
    ];
}

/** Everything a fragment owes the contract, as the problems it has. */
function problemsOf(one: Loose): string[] {
    const owner = typeof one.id === 'string' && one.id !== '' ? one.id : '(no id)';

    return [
        ...(owner === '(no id)' ? ['a fragment needs an id'] : []),
        ...blocksOf(one).flatMap((decisions) =>
            Object.entries(decisions).flatMap(([rule, decision]) =>
                decisionProblems(decision).map((problem) => `${owner}: "${rule}" ${problem}`),
            ),
        ),
    ];
}

test('every fragment lint/ declares keeps both invariants', async () => {
    // Given - every fragment a module of lint/ or src/ exports, profile or not
    const declared = await lintFragments(resolve(import.meta.dirname, '..'));
    expect(declared.length).toBeGreaterThan(15);

    // Then - none breaks the contract
    expect(declared.flatMap(({ fragment: one }) => problemsOf(one))).toStrictEqual([]);
});

test('names an off with no reason', () => {
    // Given - a decision turned off on nobody's authority
    const probe = fragment({ id: 'probe', rules: { curly: off() } });

    // Then - the audit refuses it
    expect(problemsOf(probe)).toStrictEqual(['probe: "curly" is off with no reason']);
});

test('names a reason whose kind is not one of the five', () => {
    // Given - a reason invented on the spot
    const probe = fragment({
        id: 'probe',
        rules: { curly: off({ by: 'taste', kind: 'too-strict' }) },
    });

    // Then - the five are named and the sixth is refused
    expect(problemsOf(probe)).toStrictEqual([
        'probe: "curly" is off for a reason of no known kind',
    ]);
    expect(REASON_KINDS).toHaveLength(5);
});

test('names a reason that names nothing', () => {
    // Given - a kind with no rule, page or measurement behind it
    const probe = fragment({ id: 'probe', rules: { curly: off({ by: '', kind: 'covered' }) } });

    // Then - "covered" has to say by what
    expect(problemsOf(probe)).toStrictEqual(['probe: "curly" has a reason that names nothing']);
});

test('names a level that is neither error nor off', () => {
    // Given - a fragment reaching for a warning tier
    const probe = fragment({ id: 'probe', rules: { curly: { level: 'warn' } } });

    // Then - there is no warn in this rulebook
    expect(problemsOf(probe)).toStrictEqual(['probe: "curly" is "warn" — a rule is error or off']);
});

test('names an unsafe fixer that does not say what it changes', () => {
    // Given - a fixer marked unsafe on no measurement
    const probe = fragment({ id: 'probe', rules: { curly: unsafeFix(on(), '') } });

    // Then - the mark has to carry what the rewrite does
    expect(problemsOf(probe)).toStrictEqual([
        'probe: "curly" marks an unsafe fixer without saying what it changes',
    ]);
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
