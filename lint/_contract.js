// Two invariants the package rests on: a decision is `error` or `off`, never `warn`, and an `off`
// carries exactly one reason. The builders enforce nothing; the package's own suite audits every fragment.

/**
 * @typedef {object} Reason Why a rule is off.
 * @property {string} kind One of `REASON_KINDS`.
 * @property {string} by The rule, page or measurement that carries it.
 *
 * @typedef {object} Decision What the rulebook says about one rule.
 * @property {string} rule The oxlint rule id.
 * @property {'error' | 'off'} level There is no third level.
 * @property {unknown} [options] The rule's options, at their decided value.
 * @property {Reason} [reason] Present on every `off`, absent on every `on`.
 * @property {boolean} [typeAware] Whether the rule needs type information.
 * @property {'unsafe'} [fixer] Present when the rule's own fixer changes meaning.
 * @property {string} [fixerReason] What that rewrite changes — measured, one clause.
 * @property {string} since The version the decision was taken in.
 *
 * @typedef {object} Scoped An `overrides` block, stated in decisions.
 * @property {readonly string[]} files The globs it applies to.
 * @property {Readonly<Record<string, Decision>>} decisions What it says there.
 */

export const RULEBOOK_BIRTH_VERSION = '10.0.0';

// A `consumer` rule ships; a `self` rule is this package's suite discipline and lives in its tests.
export const AUDIENCES = Object.freeze(['consumer', 'self']);

/** The five reasons an `off` may carry, and no other. */
export const REASON_KINDS = Object.freeze([
    /** Fights oxfmt — proved by the fixpoint suite. */
    'formatter',
    /** Mutually exclusive with a rule that is on — the rule is named. */
    'exclusive',
    /** Refuses a convention the estate holds — the page is named. */
    'convention',
    /** Measured false-positive rate on real estate code — the measurement is cited. */
    'evidence',
    /** Covered by TypeScript itself, or by a stronger rule that is on — it is named. */
    'covered',
]);

export function on(options) {
    return Object.freeze({ level: 'error', options });
}

export function allOn(rules) {
    return Object.fromEntries(rules.map((rule) => [rule, on()]));
}

// "Too strict" is not a reason.
export function off(reason, since) {
    return Object.freeze({ level: 'off', reason: Object.freeze({ ...reason }), since });
}

/** @param {{ level: 'error' | 'off', options?: unknown, typeAware?: boolean }} decision stays on for `check`; `fix` never applies its rewrite */
export function unsafeFix(decision, why) {
    return Object.freeze({ ...decision, fixer: 'unsafe', fixerReason: why });
}

// Every profile of this package runs `oxlint --type-aware`; the catalogue reads the mark.
export function typeAware(options) {
    return Object.freeze({ level: 'error', options, typeAware: true });
}

export function fragment(definition) {
    const {
        id,
        audience,
        plugins = [],
        jsPlugins = [],
        rules = {},
        overrides = [],
        settings,
        options,
        ignorePatterns = [],
        env,
        globals,
        since = RULEBOOK_BIRTH_VERSION,
    } = definition;

    /** @type {Record<string, Decision>} */
    const decisions = {};
    for (const [rule, decision] of Object.entries(rules)) {
        decisions[rule] = decisionFor(rule, decision, since);
    }

    return Object.freeze({
        audience,
        decisions: Object.freeze(decisions),
        env,
        globals,
        id,
        ignorePatterns: Object.freeze([...ignorePatterns]),
        jsPlugins: Object.freeze([...jsPlugins]),
        options,
        overrides: Object.freeze([...overrides]),
        plugins: Object.freeze([...plugins]),
        settings,
        since,
    });
}

export function decisionsOf(...fragments) {
    const merged = {};
    for (const one of fragments) {
        for (const [rule, decision] of Object.entries(one.decisions)) {
            merged[rule] = { ...decision, audience: one.audience, fragment: one.id };
        }
        for (const override of one.overrides) {
            for (const [rule, decision] of Object.entries(override.decisions ?? {})) {
                merged[rule] = {
                    ...decision,
                    audience: one.audience,
                    fragment: one.id,
                    scoped: override.files,
                };
            }
        }
    }
    return merged;
}

// An override's rule options replace the base entry, never merge: a block states every option.
export function scoped({ files, rules, since = RULEBOOK_BIRTH_VERSION }) {
    /** @type {Record<string, Decision>} */
    const decisions = {};
    for (const [rule, decision] of Object.entries(rules)) {
        decisions[rule] = decisionFor(rule, decision, since);
    }
    return Object.freeze({ decisions: Object.freeze(decisions), files: Object.freeze([...files]) });
}

function decisionFor(rule, decision, since) {
    return Object.freeze({ ...decision, rule, since: decision.since ?? since });
}
