import { REASON_KINDS } from '../../engine/compiler/decision.js';

// `fragment()` is not exported, so the decision invariants are a `self` rule, audited over every
// fragment a module of `lint/` or `src/` exports, whether a profile carries it or not.

export const FRAGMENT_WALK = Object.freeze({
    executables: Object.freeze(['src/cli']),
    walked: Object.freeze(['lint', 'src']),
});

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
    return typeof value === 'object' && value !== null;
}

function reasonProblem(reason: unknown): string | undefined {
    if (!isRecord(reason) || Object.keys(reason).length === 0) {
        return 'is off with no reason';
    }
    if (typeof reason.kind !== 'string' || !REASON_KINDS.includes(reason.kind)) {
        return 'is off for a reason of no known kind';
    }
    if (typeof reason.by !== 'string' || reason.by === '') {
        return 'has a reason that names nothing';
    }
    return undefined;
}

function decisionProblems(decision: unknown): string[] {
    if (!isRecord(decision)) {
        return ['is not a decision — use on(), typeAware() or off()'];
    }
    if (decision.level !== 'error' && decision.level !== 'off') {
        return [`is "${String(decision.level)}" — a rule is error or off`];
    }
    const unexplained =
        decision.fixer !== undefined &&
        (typeof decision.fixerReason !== 'string' || decision.fixerReason === '');

    return [
        decision.level === 'off' ? reasonProblem(decision.reason) : undefined,
        unexplained ? 'marks an unsafe fixer without saying what it changes' : undefined,
    ].filter((problem) => problem !== undefined);
}

function blocksOf(one: Loose): Loose[] {
    const overrides: readonly unknown[] = Array.isArray(one.overrides) ? one.overrides : [];

    return [
        isRecord(one.decisions) ? one.decisions : {},
        ...overrides.map((override) =>
            isRecord(override) && isRecord(override.decisions) ? override.decisions : {},
        ),
    ];
}

export default function problemsOf(one: Loose): string[] {
    const owner = typeof one.id === 'string' && one.id !== '' ? one.id : '(no id)';

    return [
        ...(owner === '(no id)' ? ['a fragment needs an id'] : []),
        ...blocksOf(one).flatMap((decisions) =>
            Object.entries(decisions).flatMap(([rule, decision]) =>
                decisionProblems(decision).map((problem) => `${owner}: "${rule}" ${problem}`),
            ),
        ),
    ];
}
