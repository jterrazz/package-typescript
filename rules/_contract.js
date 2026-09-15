/*
 * The rulebook's contract: a FRAGMENT is a set of decisions, one per rule of
 * one plugin, and nothing else. `compile.js` turns a fragment into the oxlint
 * config object a profile ships.
 *
 *     import { fragment, off, on } from '../_contract.js';
 *
 *     export default fragment({
 *         id: 'core/promise',
 *         plugins: ['promise'],
 *         since: '10.0.0',
 *         rules: {
 *             'promise/no-nesting': on(),
 *             'promise/always-return': off({ kind: 'exclusive', by: 'promise/prefer-await-to-then' }),
 *         },
 *     });
 *
 * Two invariants the whole package rests on: a decision is `error` or `off`,
 * never `warn`; and an `off` carries exactly one recorded reason.
 */

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

/** The version this rulebook was born in — the default `since` of every decision. */
export const SINCE = '10.0.0';

/** The five reasons an `off` may carry. Anything else is refused at load time. */
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

/**
 * A rule that is on. Every rule of the rulebook is on at `error`; the optional
 * argument is the rule's options, at their strictest sensible value.
 */
export function on(options) {
    return Object.freeze({ level: 'error', options });
}

/**
 * Every named rule, on at `error` with its default options — the bulk of a
 * fragment, where the rule id IS the whole decision.
 */
export function allOn(rules) {
    return Object.fromEntries(rules.map((rule) => [rule, on()]));
}

/**
 * A rule that is off, and why. `reason` is `{ kind, by }` where `kind` is one
 * of `REASON_KINDS` and `by` names the rule, page or measurement that carries
 * the decision. "Too strict" is not a reason.
 */
export function off(reason, since) {
    assertReason(reason);
    return Object.freeze({ level: 'off', reason: Object.freeze({ ...reason }), since });
}

/**
 * A decision whose FIXER changes meaning. The rule stays on — `check` reports
 * it and a human answers it — but `fix` never applies the rewrite: the eight
 * marked here have each been measured turning working code into code that
 * does not compile, or into code that claims something else
 * ([Lint presets](../docs/07-lint-presets.md)).
 */
export function unsafeFix(decision, why) {
    if (typeof why !== 'string' || why.length === 0) {
        throw new TypeError('An unsafe fixer must say what its rewrite changes.');
    }
    return Object.freeze({ ...decision, fixer: 'unsafe', fixerReason: why });
}

/**
 * A rule that is on and needs type information — `oxlint --type-aware`, which
 * every profile of this package turns on. The mark is what the catalogue reads.
 */
export function typeAware(options) {
    return Object.freeze({ level: 'error', options, typeAware: true });
}

/**
 * Declare a fragment: one plugin's decisions, or one framework's. `rules` maps
 * an oxlint rule id to an `on()` / `typeAware()` / `off()` decision, and every
 * decision inherits the fragment's `since` unless it carries its own.
 */
export function fragment(definition) {
    const {
        id,
        plugins = [],
        jsPlugins = [],
        rules = {},
        overrides = [],
        settings,
        options,
        ignorePatterns = [],
        env,
        globals,
        since = SINCE,
    } = definition;

    if (typeof id !== 'string' || id.length === 0) {
        throw new TypeError('A fragment needs an id.');
    }

    /** @type {Record<string, Decision>} */
    const decisions = {};
    for (const [rule, decision] of Object.entries(rules)) {
        decisions[rule] = normalise(id, rule, decision, since);
    }

    return Object.freeze({
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

/** Every decision of every fragment, keyed by rule id, fragments merged left to right. */
export function decisionsOf(...fragments) {
    const merged = {};
    for (const one of fragments) {
        for (const [rule, decision] of Object.entries(one.decisions)) {
            merged[rule] = { ...decision, fragment: one.id };
        }
        for (const override of one.overrides) {
            for (const [rule, decision] of Object.entries(override.decisions ?? {})) {
                merged[rule] = { ...decision, fragment: one.id, scoped: override.files };
            }
        }
    }
    return merged;
}

/**
 * An `overrides` block, stated in decisions like a fragment's own body. Its
 * rule options REPLACE the base entry — they never merge — so a block states
 * the complete option list for every rule it names.
 */
export function scoped({ files, rules, since = SINCE }) {
    /** @type {Record<string, Decision>} */
    const decisions = {};
    for (const [rule, decision] of Object.entries(rules)) {
        decisions[rule] = normalise(files.join(','), rule, decision, since);
    }
    return Object.freeze({ decisions: Object.freeze(decisions), files: Object.freeze([...files]) });
}

function assertReason(reason) {
    if (!reason || typeof reason !== 'object') {
        throw new TypeError('An off decision needs a reason.');
    }
    if (!REASON_KINDS.includes(reason.kind)) {
        throw new TypeError(`Unknown reason kind "${reason.kind}".`);
    }
    if (typeof reason.by !== 'string' || reason.by.length === 0) {
        throw new TypeError(`A "${reason.kind}" reason must name what carries it.`);
    }
}

function normalise(owner, rule, decision, since) {
    if (!decision || typeof decision !== 'object' || typeof decision.level !== 'string') {
        throw new TypeError(
            `${owner}: "${rule}" is not a decision — use on(), typeAware() or off().`,
        );
    }
    if (decision.level !== 'error' && decision.level !== 'off') {
        throw new TypeError(`${owner}: "${rule}" is "${decision.level}" — a rule is error or off.`);
    }
    if (decision.level === 'off') {
        assertReason(decision.reason);
    }
    return Object.freeze({ ...decision, rule, since: decision.since ?? since });
}
