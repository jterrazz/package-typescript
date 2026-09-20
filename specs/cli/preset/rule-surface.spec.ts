import { expect, test } from 'vitest';

import { REASON_KINDS } from '../../../rules/_contract.js';
import { catalog } from '../../../rules/catalog.js';
import { PROFILES as PROFILE_TABLE } from '../../../rules/profiles.js';
import { printConfig, PROFILES, roster } from './rulebook.js';

/*
 * Law 1 of the rulebook, made mechanical: every rule of every plugin a profile
 * loads is decided by name, `categories` appears nowhere, and every `off`
 * carries one of the five recorded reasons.
 *
 * This is what keeps the word "comprehensive" true across a weekly oxlint
 * release. Nursery is the one exception, and it is upstream's: a nursery rule
 * is declared unstable, so the rulebook does not decide it at all.
 */

/** oxlint reports a plugin scope with underscores and spells the rule id with dashes. */
function idOf(rule: { scope: string; value: string }): string {
    const scope = rule.scope.replaceAll('_', '-');
    return scope === 'eslint' ? rule.value : `${scope}/${rule.value}`;
}

const RULES = roster();
const DECIDED = new Set(catalog().map((entry) => entry.rule));

test.each(PROFILES)('$name decides every non-nursery rule of every plugin it loads', ({ name }) => {
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
});

test('decides no nursery rule — upstream calls them unstable', () => {
    // Given - the nursery rules of this oxlint
    const nursery = RULES.filter((rule) => rule.category === 'nursery').map((rule) => idOf(rule));

    // Then - none of them is in the manifest
    expect(nursery.filter((rule) => DECIDED.has(rule))).toStrictEqual([]);
});

test.each(PROFILES)('$name ships no categories switch', ({ name }) => {
    // Given - the compiled profile a consumer extends
    const compiled = JSON.stringify(PROFILE_TABLE[name]);

    /*
     * A category arms rules of plugins the config never names: inert until a
     * framework config activates the plugin, and firing unannounced from then.
     */

    // Then - nothing in the manifest reaches for a category
    expect(compiled).not.toContain('categories');
});

test('marks a rule type-aware when, and only when, oxlint says it is', () => {
    // Given - the manifest's own type-aware marks
    const upstream = new Map(RULES.map((rule) => [idOf(rule), rule.type_aware]));

    // Then - each one matches the pinned oxlint's answer
    const wrong = catalog()
        .filter((entry) => entry.level === 'error' && upstream.has(entry.rule))
        .filter((entry) => Boolean(entry.typeAware) !== upstream.get(entry.rule))
        .map((entry) => entry.rule);

    expect(wrong).toStrictEqual([]);
});

test('gives every off one of the five recorded reasons', () => {
    // Given - every rule the rulebook turns off
    const offs = catalog().filter((entry) => entry.level === 'off');
    expect(offs.length).toBeGreaterThan(0);

    // Then - each one names its kind and what carries it
    for (const entry of offs) {
        const reason = entry.reason ?? { by: '', kind: 'none' };
        expect.soft(REASON_KINDS, `${entry.rule} has kind "${reason.kind}"`).toContain(reason.kind);
        expect.soft(reason.by, `${entry.rule} names nothing`).not.toBe('');
    }
});

test('keeps only the perfectionist rules oxfmt does not sort', () => {
    /*
     * Measured on a fixture: oxfmt's `sortImports` reorders import STATEMENTS
     * and leaves the named specifiers inside one statement alone.
     */

    // Given - oxfmt owns import order, package.json key order and Tailwind class order
    const OWNED_BY_OXFMT = new Set(['perfectionist/sort-imports', 'perfectionist/sort-exports']);

    // Then - no perfectionist rule the rulebook keeps is one of them
    const kept = catalog()
        .filter((entry) => entry.rule.startsWith('perfectionist/') && entry.level === 'error')
        .map((entry) => entry.rule);

    expect(kept.length).toBeGreaterThan(0);
    expect(kept.filter((rule) => OWNED_BY_OXFMT.has(rule))).toStrictEqual([]);
});
