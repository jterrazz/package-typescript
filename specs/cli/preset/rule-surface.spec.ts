import { describe, expect, test } from 'vitest';

import { PROFILES as PROFILE_TABLE } from '../../../lint/consumer/rulebook/profiles.js';
import { decisions, unsafeFixers } from '../../../lint/engine/catalogue/decisions.js';
import { REASON_KINDS } from '../../../lint/engine/rulebook/decision.js';
import { printConfig, PROFILES, roster } from './rulebook.js';

// Nursery is upstream's one exception: a nursery rule is declared unstable, so the rulebook does not decide it.

// oxlint reports a plugin scope with underscores and spells the rule id with dashes.
function idOf(rule: { scope: string; value: string }): string {
    const scope = rule.scope.replaceAll('_', '-');
    return scope === 'eslint' ? rule.value : `${scope}/${rule.value}`;
}

const RULES = roster();
const DECIDED = new Set(decisions(PROFILE_TABLE).map((entry) => entry.rule));

describe('rule-surface', () => {
    test.each(PROFILES)(
        '$name decides every non-nursery rule of every plugin it loads',
        ({ name }) => {
            // Given - the plugins the profile actually loads, as oxlint resolves them
            const plugins = new Set(printConfig(name).plugins);

            // Then - every non-nursery rule of each of them is in the manifest
            const missing = RULES.filter(
                (rule) =>
                    rule.category !== 'nursery' &&
                    plugins.has(rule.scope.replaceAll('_', '-')) &&
                    !DECIDED.has(idOf(rule)),
            ).map((rule) => idOf(rule));

            expect(missing, `${name} leaves ${missing.length} rules undecided`).toStrictEqual([]);
        },
    );

    test('decides no nursery rule tsgolint does not run — upstream calls them unstable', () => {
        // Given - the nursery rules of this oxlint that need no type information
        const nursery = RULES.filter((rule) => rule.category === 'nursery' && !rule.type_aware).map(
            (rule) => idOf(rule),
        );

        // Then - none of them is in the manifest
        expect(nursery.filter((rule) => DECIDED.has(rule))).toStrictEqual([]);
    });

    test('decides every rule the installed tsgolint runs, by name, nursery included', () => {
        // Given - every rule the pinned oxlint hands to tsgolint
        const typeAware = RULES.filter((rule) => rule.type_aware).map((rule) => idOf(rule));
        expect(typeAware.length).toBeGreaterThan(0);

        // Then - the manifest decides each one
        const undecided = typeAware.filter((rule) => !DECIDED.has(rule));
        expect(
            undecided,
            `found: ${undecided.join(', ')} — type-aware, and decided nowhere in lint/ · why: every rule tsgolint runs is decided by name, so a tsgolint release never adds a check no profile names · fix: decide each in lint/consumer/rulebook/typescript.js — \`typeAware()\`, or \`off()\` with its reason · read: docs/07-lint-presets.md#the-four-laws`,
        ).toStrictEqual([]);
    });

    test.each(PROFILES)('$name ships no categories switch', ({ name }) => {
        // Given - the compiled profile a consumer extends
        const compiled = JSON.stringify(PROFILE_TABLE[name]);

        // A category arms rules of plugins the config never names, which fire unannounced once activated.

        // Then - nothing in the manifest reaches for a category
        expect(compiled).not.toContain('categories');
    });

    test('marks a rule type-aware when, and only when, oxlint says it is', () => {
        // Given - the manifest's own type-aware marks
        const upstream = new Map(RULES.map((rule) => [idOf(rule), rule.type_aware]));

        // Then - each one matches the pinned oxlint's answer
        const wrong = decisions(PROFILE_TABLE)
            .filter((entry) => entry.level === 'error' && upstream.has(entry.rule))
            .filter((entry) => Boolean(entry.typeAware) !== upstream.get(entry.rule))
            .map((entry) => entry.rule);

        expect(wrong).toStrictEqual([]);
    });

    // Measured on 1.85: a `conditional_dangerous` fixer rewrote a `declare module` block without `--fix-dangerously`.
    const APPLIED_BY_FIX = new Set([
        'conditional_dangerous_fix',
        'conditional_dangerous_fix_or_suggestion',
        'conditional_fix',
        'conditional_safe_fix_or_suggestion',
        'fixable_fix',
        'fixable_safe_fix_or_suggestion',
    ]);

    test('marks a fixer unsafe only where plain --fix would apply it', () => {
        // Given - the fix kind the pinned oxlint gives each rule
        const upstream = new Map(RULES.map((rule) => [idOf(rule), rule.fix]));

        // Then - every rule the fix wrapper disarms has a fixer plain --fix runs
        const idle = unsafeFixers(PROFILE_TABLE)
            .map(({ rule }) => rule)
            .filter((rule) => !APPLIED_BY_FIX.has(upstream.get(rule) ?? ''))
            .map((rule) => `${rule} (${upstream.get(rule) ?? 'unknown'})`);

        expect(
            idle,
            `found: ${idle.join(', ')} — marked unsafe, and plain --fix never applies its fixer · fix: find the rule whose fixer makes the rewrite its reason names, and mark that one · read: docs/07-lint-presets.md#fixers-that-lie`,
        ).toStrictEqual([]);
    });

    test('gives every off one of the five recorded reasons', () => {
        // Given - every rule the rulebook turns off
        const offs = decisions(PROFILE_TABLE).filter((entry) => entry.level === 'off');
        expect(offs.length).toBeGreaterThan(0);

        // Then - each one names its kind and what carries it
        for (const entry of offs) {
            const reason = entry.reason ?? { by: '', kind: 'none' };
            expect
                .soft(REASON_KINDS, `${entry.rule} has kind "${reason.kind}"`)
                .toContain(reason.kind);
            expect.soft(reason.by, `${entry.rule} names nothing`).not.toBe('');
        }
    });

    test('keeps only the perfectionist rules oxfmt does not sort', () => {
        // Measured: oxfmt's `sortImports` leaves the specifiers inside one statement alone.

        // Given - oxfmt owns import order, package.json key order and Tailwind class order
        const OWNED_BY_OXFMT = new Set([
            'perfectionist/sort-imports',
            'perfectionist/sort-exports',
        ]);

        // Then - no perfectionist rule the rulebook keeps is one of them
        const kept = decisions(PROFILE_TABLE)
            .filter((entry) => entry.rule.startsWith('perfectionist/') && entry.level === 'error')
            .map((entry) => entry.rule);

        expect(kept.length).toBeGreaterThan(0);
        expect(kept.filter((rule) => OWNED_BY_OXFMT.has(rule))).toStrictEqual([]);
    });
});
