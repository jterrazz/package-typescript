import { PROFILES } from '../rulebook/profiles.js';

/**
 * @typedef {object} Entry One decision, with the profiles that carry it.
 * @property {string} rule The oxlint rule id.
 * @property {'error' | 'off'} level What the rulebook says about it.
 * @property {unknown} [options] The rule's options, at their decided value.
 * @property {{ by: string, kind: string }} [reason] Why it is off.
 * @property {boolean} [typeAware] Whether it needs type information.
 * @property {readonly string[]} [scoped] The globs it applies to, when not all of them.
 * @property {string} fragment The fragment that took the decision.
 * @property {'consumer' | 'self'} audience Who the fragment declares the decision is for.
 * @property {string} since The version the decision was taken in.
 * @property {string[]} profiles The profiles that carry it.
 */

// Composition is last-wins per rule, so each profile resolves before grouping: a reader is owed
// `import/extensions` as `always` under node and `never` under the bundler profiles, each on its own line.

export function decisions() {
    /** @type {Map<string, Entry>} */
    const grouped = new Map();

    for (const [name, definition] of Object.entries(PROFILES)) {
        for (const [key, decision] of resolve(definition).entries()) {
            const identity = `${key} @ ${decision.level} @ ${JSON.stringify(decision.options ?? null)}`;
            const existing = grouped.get(identity);

            if (existing === undefined) {
                grouped.set(identity, { ...decision, profiles: [name] });
            } else {
                existing.profiles.push(name);
            }
        }
    }

    return [...grouped.values()].toSorted(
        (left, right) =>
            left.rule.localeCompare(right.rule) || left.fragment.localeCompare(right.fragment),
    );
}

function resolve(definition) {
    /** @type {Map<string, Entry>} */
    const resolved = new Map();

    for (const fragment of definition.fragments) {
        absorb(resolved, fragment, fragment.decisions);
        for (const override of fragment.overrides) {
            absorb(resolved, fragment, override.decisions, override.files);
        }
    }

    return resolved;
}

function absorb(resolved, fragment, entries, scoped) {
    const scope = scoped === undefined ? '' : scoped.join(',');

    for (const [rule, decision] of Object.entries(entries)) {
        resolved.set(`${rule} @ ${scope}`, {
            ...decision,
            audience: fragment.audience,
            fragment: fragment.id,
            rule,
            scoped,
        });
    }
}

/** @returns {{ rule: string, why: string }[]} each rule once, sorted by name */
export function unsafeFixers() {
    /** @type {Map<string, string>} */
    const seen = new Map();
    for (const entry of decisions()) {
        if (entry.fixer === 'unsafe' && !seen.has(entry.rule)) {
            seen.set(entry.rule, entry.fixerReason);
        }
    }

    return [...seen.entries()]
        .map(([rule, why]) => ({ rule, why }))
        .toSorted((left, right) => left.rule.localeCompare(right.rule));
}
