import type { Profile } from '../compiler/compile.js';
import type { Decision, Fragment, Merged } from '../compiler/decision.js';

/** One decision, with the profiles that carry it. */
export type Entry = Merged & {
    /** The profiles that carry it. */
    profiles: string[];
};

type Resolved = Omit<Entry, 'profiles'>;

// invariant: composition is last-wins per rule, so each profile resolves before grouping: a reader is owed
// `import/extensions` as `always` under node and `never` under the bundler profiles, each on its own line.

export function decisions(profiles: Readonly<Record<string, Profile>>): Entry[] {
    const grouped = new Map<string, Entry>();

    for (const [name, definition] of Object.entries(profiles)) {
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

function resolve(definition: Profile): Map<string, Resolved> {
    const resolved = new Map<string, Resolved>();

    for (const fragment of definition.fragments) {
        absorb(resolved, fragment, fragment.decisions);
        for (const override of fragment.overrides) {
            absorb(resolved, fragment, override.decisions, override.files);
        }
    }

    return resolved;
}

function absorb(
    resolved: Map<string, Resolved>,
    fragment: Fragment,
    entries: Readonly<Record<string, Decision>>,
    scoped?: readonly string[],
): void {
    const scope = scoped === undefined ? '' : scoped.join(',');

    for (const [rule, decision] of Object.entries(entries)) {
        resolved.set(`${rule} @ ${scope}`, {
            ...decision,
            audience: fragment.audience,
            fragment: fragment.id,
            rule,
            ...(scoped === undefined ? {} : { scoped }),
        });
    }
}

/** Each rule once, sorted by name. */
export function unsafeFixers(
    profiles: Readonly<Record<string, Profile>>,
): { rule: string; why: string }[] {
    const seen = new Map<string, string>();
    for (const entry of decisions(profiles)) {
        if (entry.fixer === 'unsafe' && !seen.has(entry.rule)) {
            seen.set(entry.rule, entry.fixerReason ?? '');
        }
    }

    return [...seen.entries()]
        .map(([rule, why]) => ({ rule, why }))
        .toSorted((left, right) => left.rule.localeCompare(right.rule));
}
