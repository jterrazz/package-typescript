import { PROFILES } from './profiles.js';

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

/*
 * The catalogue: every decision of every profile, with the profiles that carry
 * it. It is the one place the rulebook is readable as a list: `fix` reads its
 * unsafe fixers, and the GENERATED sections of
 * [Lint presets](../docs/07-lint-presets.md) are its projection, rendered and
 * held fresh by this package's own suite — a `self` rule, which ships nowhere
 * ([Testing](https://github.com/jterrazz/package-typescript/blob/main/docs/03-testing.md)).
 *
 * Composition is last-wins per rule, so the catalogue resolves each profile
 * first and groups after: `import/extensions` is `always` under node and
 * `never` under the bundler profiles, and a reader is owed both lines, each
 * naming only the profiles it is true for.
 */

/** Every decision, in rule order, one entry per distinct decision. */
export function catalog() {
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

/** One profile's decisions, its fragments applied left to right, last wins per rule and scope. */
function resolve(definition) {
    /** @type {Map<string, Entry>} */
    const decisions = new Map();

    for (const fragment of definition.fragments) {
        absorb(decisions, fragment, fragment.decisions);
        for (const override of fragment.overrides) {
            absorb(decisions, fragment, override.decisions, override.files);
        }
    }

    return decisions;
}

function absorb(decisions, fragment, entries, scoped) {
    const scope = scoped === undefined ? '' : scoped.join(',');

    for (const [rule, decision] of Object.entries(entries)) {
        decisions.set(`${rule} @ ${scope}`, {
            ...decision,
            audience: fragment.audience,
            fragment: fragment.id,
            rule,
            scoped,
        });
    }
}

/**
 * Every rule whose own fixer changes meaning, with what the rewrite does.
 * `check` reports them and a human answers them; `fix` runs with each one
 * allowed, so the rewrite is never applied
 * ([Quality checks](../docs/06-quality-checks.md)).
 *
 * @returns {{ rule: string, why: string }[]} Each rule once, sorted by name.
 */
export function unsafeFixers() {
    /** @type {Map<string, string>} */
    const seen = new Map();
    for (const entry of catalog()) {
        if (entry.fixer === 'unsafe' && !seen.has(entry.rule)) {
            seen.set(entry.rule, entry.fixerReason);
        }
    }

    return [...seen.entries()]
        .map(([rule, why]) => ({ rule, why }))
        .toSorted((left, right) => left.rule.localeCompare(right.rule));
}
