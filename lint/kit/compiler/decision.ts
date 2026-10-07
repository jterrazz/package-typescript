// invariant: two invariants the package rests on: a decision is `error` or `off`, never `warn`, and an `off`
// carries exactly one reason. The builders enforce nothing; the package's own suite audits every fragment.

import type { OxlintConfig, OxlintGlobals } from 'oxlint';

/** Why a rule is off. */
export type Reason = {
    /** One of `REASON_KINDS`. */
    kind: string;
    /** The rule, page or measurement that carries it. */
    by: string;
};

/** A decision as a fragment states it, before its rule and version are stamped on. */
export type Stated = {
    readonly fixer?: 'unsafe' | undefined;
    readonly fixerReason?: string | undefined;
    readonly level: 'error' | 'off';
    readonly options?: unknown;
    readonly reason?: Readonly<Reason> | undefined;
    readonly since?: string | undefined;
    readonly typeAware?: boolean | undefined;
};

/** What the rulebook says about one rule. */
export type Decision = Stated & {
    /** The oxlint rule id. */
    readonly rule: string;
    /** The version the decision was taken in. */
    readonly since: string;
};

/** An `overrides` block, stated in decisions. */
export type Scoped = {
    /** What it says there. */
    readonly decisions: Readonly<Record<string, Decision>>;
    /** The globs it applies to. */
    readonly files: readonly string[];
};

export type Audience = 'consumer' | 'self';

export type Plugin = NonNullable<OxlintConfig['plugins']>[number];

export type FragmentDefinition = {
    audience: Audience;
    env?: Readonly<Record<string, boolean>>;
    globals?: Readonly<OxlintGlobals>;
    id: string;
    ignorePatterns?: readonly string[];
    jsPlugins?: readonly string[];
    options?: Readonly<Record<string, unknown>>;
    overrides?: readonly Scoped[];
    plugins?: readonly Plugin[];
    rules?: Readonly<Record<string, Stated>>;
    settings?: Readonly<Record<string, unknown>>;
    since?: string;
};

export type Fragment = {
    readonly audience: Audience;
    readonly decisions: Readonly<Record<string, Decision>>;
    readonly env: Readonly<Record<string, boolean>> | undefined;
    readonly globals: Readonly<OxlintGlobals> | undefined;
    readonly id: string;
    readonly ignorePatterns: readonly string[];
    readonly jsPlugins: readonly string[];
    readonly options: Readonly<Record<string, unknown>> | undefined;
    readonly overrides: readonly Scoped[];
    readonly plugins: readonly Plugin[];
    readonly settings: Readonly<Record<string, unknown>> | undefined;
    readonly since: string;
};

export type Merged = Decision & {
    readonly audience: Audience;
    readonly fragment: string;
    readonly scoped?: readonly string[] | undefined;
};

const RULEBOOK_BIRTH_VERSION = '10.0.0';

// invariant: a `consumer` rule ships; a `self` rule is this package's suite discipline and lives in its tests.
export const AUDIENCES: readonly Audience[] = Object.freeze(['consumer', 'self']);

/** The five reasons an `off` may carry, and no other. */
export const REASON_KINDS: readonly string[] = Object.freeze([
    // invariant: fights oxfmt — proved by the fixpoint suite.
    'formatter',
    // invariant: mutually exclusive with a rule that is on — the rule is named.
    'exclusive',
    // invariant: refuses a convention the estate holds — the page is named.
    'convention',
    // invariant: a measured false-positive rate on real estate code — the measurement is cited.
    'evidence',
    // invariant: covered by TypeScript itself, or by a stronger rule that is on — it is named.
    'covered',
]);

export function on(options?: unknown): Stated {
    return Object.freeze({ level: 'error', options });
}

export function allOn(rules: readonly string[]): Record<string, Stated> {
    return Object.fromEntries(rules.map((rule) => [rule, on()]));
}

// invariant: "Too strict" is not a reason.
export function off(reason: Reason, since?: string): Stated {
    return Object.freeze({ level: 'off', reason: Object.freeze({ ...reason }), since });
}

/** Stays on for `check`; `fix` never applies its rewrite. */
export function unsafeFix(decision: Stated, why: string): Stated {
    return Object.freeze({ ...decision, fixer: 'unsafe', fixerReason: why });
}

// invariant: every profile of this package runs `oxlint --type-aware`; the catalogue reads the mark.
export function typeAware(options?: unknown): Stated {
    return Object.freeze({ level: 'error', options, typeAware: true });
}

export function fragment(definition: FragmentDefinition): Fragment {
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

    const decisions: Record<string, Decision> = {};
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

// invariant: an override's rule options replace the base entry, never merge: a block states every option.
export function scoped({
    files,
    rules,
    since = RULEBOOK_BIRTH_VERSION,
}: {
    files: readonly string[];
    rules: Readonly<Record<string, Stated>>;
    since?: string;
}): Scoped {
    const decisions: Record<string, Decision> = {};
    for (const [rule, decision] of Object.entries(rules)) {
        decisions[rule] = decisionFor(rule, decision, since);
    }
    return Object.freeze({ decisions: Object.freeze(decisions), files: Object.freeze([...files]) });
}

function decisionFor(rule: string, decision: Stated, since: string): Decision {
    return Object.freeze({ ...decision, rule, since: decision.since ?? since });
}
