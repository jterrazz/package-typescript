import { expect, test } from 'vitest';

import { catalog } from '../../../rules/catalog.js';
import { printConfig, PROFILES } from './rulebook.js';

/*
 * Two rules that demand opposite shapes cannot both be armed: whichever a file
 * satisfies, the other reports it, and no edit closes both. The pairs below are
 * the ones this rulebook meets — Ultracite's list, plus the two the estate's
 * own decisions create.
 *
 * This suite is the reason `off` carries a `kind`: every `exclusive` off names
 * the rule it cannot stand beside, and the two claims are checked against each
 * other here.
 */

/** Pairs that cannot both be on, and the sentence that says why. */
const PAIRS = Object.freeze([
    ['no-ternary', 'unicorn/prefer-ternary', 'one forbids the ternary the other demands'],
    ['no-continue', 'max-depth', '`continue` is what keeps a loop body flat'],
    [
        'node/no-top-level-await',
        'unicorn/prefer-top-level-await',
        'one forbids top-level await, the other demands it',
    ],
    [
        'oxc/no-async-await',
        'promise/prefer-await-to-then',
        'one forbids `await`, the other demands it',
    ],
    [
        'promise/always-return',
        'promise/prefer-await-to-then',
        'one describes a `.then()` chain the other refuses to have',
    ],
    [
        'promise/catch-or-return',
        'promise/prefer-await-to-then',
        'one describes a `.then()` chain the other refuses to have',
    ],
    [
        'vitest/prefer-describe-function-title',
        'vitest/valid-title',
        'one titles a describe after the function, the other after the behaviour',
    ],
    [
        'vitest/prefer-called-times',
        'vitest/prefer-called-once',
        'one counts the calls, the other names the count',
    ],
    [
        'vitest/no-importing-vitest-globals',
        'vitest/prefer-importing-vitest-globals',
        'one forbids the import the other demands',
    ],
    [
        'vitest/prefer-strict-boolean-matchers',
        'vitest/prefer-to-be-truthy',
        'one wants a strict boolean matcher, the other the truthy one',
    ],
    [
        'vitest/prefer-strict-boolean-matchers',
        'vitest/prefer-to-be-falsy',
        'one wants a strict boolean matcher, the other the falsy one',
    ],
    [
        'typescript/no-non-null-assertion',
        'typescript/non-nullable-type-assertion-style',
        'one forbids the `!` assertion the other fix asks for',
    ],
    [
        'vitest/no-hooks',
        'vitest/prefer-hooks-in-order',
        'one forbids hooks, the other says where they go',
    ],
] as const);

const DECISIONS = catalog();

/** Every state a rule is in, across the profiles that carry it. */
function levelsOf(rule: string): string[] {
    return DECISIONS.filter((entry) => entry.rule === rule).map((entry) => entry.level);
}

test.each(PAIRS)('%s and %s are never both on', (left, right, why) => {
    // Given - a pair that cannot both be armed
    const armed = [left, right].filter((rule) => levelsOf(rule).includes('error'));

    // Then - the rulebook keeps exactly one of them
    expect(armed, `${left} and ${right}: ${why}`).toHaveLength(1);
});

/** Whether a resolved config arms a rule, in oxlint's own vocabulary. */
function isArmed(rules: Record<string, unknown>, rule: string): boolean {
    const entry = rules[rule];
    const level = Array.isArray(entry) ? String(entry[0]) : String(entry);
    return level === 'deny' || level === 'warn';
}

test.each(PROFILES)('$name arms one rule of every exclusive pair', ({ name }) => {
    // Given - the profile as oxlint resolves it
    const { rules } = printConfig(name);

    // Then - no resolved config has both halves of a pair
    const both = PAIRS.filter(([left, right]) => isArmed(rules, left) && isArmed(rules, right)).map(
        ([left, right, why]) => `${left} vs ${right} — ${why}`,
    );
    expect(both, `${name} arms both halves of a pair`).toStrictEqual([]);
});
