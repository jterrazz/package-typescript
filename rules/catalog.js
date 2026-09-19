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
 * @property {string} since The version the decision was taken in.
 * @property {string[]} profiles The profiles that carry it.
 */

/*
 * The catalogue: every decision of every profile, with the profiles that carry
 * it. It is the one place the rulebook is readable as a list, and the GENERATED
 * section of [Lint presets](../docs/07-lint-presets.md) is its projection —
 * `rules/catalog.test.ts` fails a chapter that has drifted from it.
 *
 * Composition is last-wins per rule, so the catalogue resolves each profile
 * first and groups after: `import/extensions` is `always` under node and
 * `never` under the bundler profiles, and a reader is owed both lines, each
 * naming only the profiles it is true for.
 */

/** The fence that bounds the generated section of the chapter. */
export const MARKERS = Object.freeze({
    end: '<!-- /GENERATED -->',
    start: '<!-- GENERATED -->',
});

/** The fence that bounds the list of fixers `fix` refuses to run. */
export const FIXER_MARKERS = Object.freeze({
    end: '<!-- /GENERATED:fixers -->',
    start: '<!-- GENERATED:fixers -->',
});

/** Every profile there is, so a decision carried by all of them says `all`. */
const EVERY_PROFILE = Object.keys(PROFILES).length;

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

/** The catalogue as the markdown table the chapter carries between its markers. */
export function render() {
    const rows = catalog().map((entry) => {
        const state = entry.level === 'off' ? 'off' : 'on';
        const why =
            entry.level === 'off' ? `${entry.reason.kind} — ${entry.reason.by}` : scopeOf(entry);
        return `| \`${entry.rule}\` | ${entry.profiles.join(', ')} | ${state} | ${why} | ${entry.since} |`;
    });

    return [
        '| Rule | Profiles | State | Reason | Since |',
        '| --- | --- | --- | --- | --- |',
        ...rows,
    ].join('\n');
}

/**
 * The same catalogue, trimmed for an agent: what the rule is, whether it runs,
 * the reason in one clause, and where. No `since` column — an agent is reading
 * to answer "may I write this", not "when was this decided", and the chapter
 * carries that half.
 */
export function renderReference() {
    const rows = catalog().map((entry) => {
        const state = entry.level === 'off' ? 'off' : 'on';
        const why = entry.level === 'off' ? reasonClause(entry.reason) : agentScopeOf(entry);
        const where = entry.profiles.length === EVERY_PROFILE ? 'all' : entry.profiles.join(', ');

        return `| \`${entry.rule}\` | ${state} | ${why} | ${where} |`;
    });

    return ['| Rule | State | Why | Profiles |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/** Where the vitest fragment applies, named by its owner rather than spelled out. */
const TEST_FILE_ROUTE = "scoped to test files — @jterrazz/test's catalogue owns the shapes";

/**
 * The scope an AGENT is owed. Seventy-odd vitest rows each restated the same
 * three globs, and one of them — the `__tests__` directory shape — is a layout
 * the test package's own rulebook refuses: a page an agent reads to decide
 * where to put a file would have been advertising it seventy times. So the
 * vitest block names its owner and the agent goes there for the shapes, which
 * is the package that decides them.
 */
function agentScopeOf(entry) {
    if (entry.fragment === 'vitest' && entry.scoped !== undefined) {
        return TEST_FILE_ROUTE;
    }

    return scopeOf(entry);
}

/** An `off` in one clause: its kind, and the first thing its reason names. */
function reasonClause({ by, kind }) {
    return `${kind}: ${by.split(' — ')[0]}`;
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
            fragment: fragment.id,
            rule,
            scoped,
        });
    }
}

/** What an `on` entry has to say for itself: where it applies, when that is not everywhere. */
function scopeOf(entry) {
    if (entry.scoped === undefined) {
        return entry.typeAware === true ? 'type-aware' : '—';
    }
    return `scoped to ${entry.scoped.map((glob) => `\`${glob}\``).join(', ')}`;
}

/**
 * Every rule whose own fixer changes meaning, with what the rewrite does.
 * `check` reports them and a human answers them; `fix` runs with each one
 * allowed, so the rewrite is never applied
 * ([Quality checks](../docs/06-quality-checks.md)).
 */
export function unsafeFixers() {
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

/** The same list as the markdown the chapter carries between its fixer markers. */
export function renderFixers() {
    return unsafeFixers()
        .map(({ rule, why }) => `- \`${rule}\` — ${why}`)
        .join('\n');
}
