import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    [key: string]: unknown;
    argument?: Node;
    arguments?: Node[];
    async?: boolean;
    body?: Node[];
    callee?: Node;
    computed?: boolean;
    declarations?: { id: Node; init: Node | null }[];
    end: number;
    expression?: Node;
    kind?: string;
    name?: string;
    property?: Node;
    start: number;
    type: string;
};

type RuleContext = {
    report: (report: { data?: Record<string, string>; messageId: string; node: Node }) => void;
};

export const PROMISE_IS_AWAITED_NAME = 'promise-is-awaited';

const CHAIN_METHODS: ReadonlySet<string> = new Set(['catch', 'finally', 'then']);

// invariant: the call's value is handed on whole, so the chain is the caller's.
const HANDED_ON: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'ReturnStatement']);

// invariant: a chain anywhere inside an awaited or yielded expression of its own function is read by that `await` — `await Promise.all([task.catch(…)])`.
const AWAITING: ReadonlySet<string> = new Set(['AwaitExpression', 'YieldExpression']);

const VALUES: ReadonlySet<string> = new Set([
    'ArrayExpression',
    'BinaryExpression',
    'Literal',
    'NewExpression',
    'ObjectExpression',
    'TemplateLiteral',
    'UnaryExpression',
]);

const WRAPPERS: ReadonlySet<string> = new Set([
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
]);

// invariant: an expression's functions alone: a declaration is never called where it is declared, nor sits inside an `await`.
const FUNCTIONS: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

const WHY_FIX = {
    fix: 'await the promise, inside a `try`/`catch` for its failure; a call that only shares the name — a zod schema’s `.catch(fallback)` — takes its fallback as a value, a literal or a `const` naming one, which the rule reads as no promise',
    why: 'the estate writes `await`: a promise read top to bottom, its failure caught where a `try` says so, never a chain of callbacks threading the value through',
};

type Chain = { awaited: boolean; call: Node; method: string; parent: Node };

type Constants = Map<string | undefined, Node | null>;

const isNode = (value: unknown): value is Node =>
    typeof value === 'object' && value !== null && 'type' in value;

function childrenOf(node: Node): Node[] {
    return Object.entries(node)
        .filter(([key]) => key !== 'parent')
        .flatMap(([, value]) => [value].flat())
        .filter((value) => isNode(value));
}

function unwrapped(node: Node): Node {
    const inner = WRAPPERS.has(node.type) ? node.expression : undefined;
    return inner === undefined ? node : unwrapped(inner);
}

// invariant: a computed member (`record[then]`) and a private one (`this.#then`) are no promise method.
function methodOf(node: Node): string | undefined {
    // Stryker disable OptionalChaining: a call always has a callee
    const property =
        node.type === 'CallExpression' && node.callee?.computed !== true
            ? node.callee?.property
            : undefined;
    // Stryker restore OptionalChaining
    return property?.type === 'Identifier' && CHAIN_METHODS.has(property.name ?? '')
        ? property.name
        : undefined;
}

function isAsyncIife(statement: Node): boolean {
    const expression =
        statement.expression === undefined ? undefined : unwrapped(statement.expression);
    const operand = expression?.type === 'UnaryExpression' ? expression.argument : expression;
    const call = operand === undefined ? undefined : unwrapped(operand);
    const callee = call?.callee === undefined ? undefined : unwrapped(call.callee);

    return callee !== undefined && FUNCTIONS.has(callee.type) && callee.async === true;
}

function recordConstants(node: Node, constants: Constants): void {
    if (node.kind !== 'const') {
        return;
    }
    for (const { id, init } of node.declarations ?? []) {
        // invariant: a name declared twice — in two scopes — is no value the rule can tell; a pattern binds no one name.
        constants.set(id.name, constants.has(id.name) ? null : init);
    }
}

function readOf(program: Node): { chains: Chain[]; constants: Constants } {
    const chains: Chain[] = [];
    const constants: Constants = new Map();
    const walk = (parent: Node, awaited: boolean): void => {
        for (const node of childrenOf(parent)) {
            recordConstants(node, constants);
            const method = methodOf(node);
            if (method !== undefined) {
                chains.push({ awaited, call: node, method, parent });
            }
            walk(node, !FUNCTIONS.has(node.type) && (awaited || AWAITING.has(node.type)));
        }
    };
    walk(program, false);

    return { chains, constants };
}

function isValue(node: Node, constants: Constants, seen: ReadonlySet<string>): boolean {
    const value = unwrapped(node);
    if (VALUES.has(value.type) || value.name === 'undefined') {
        return true;
    }
    // Stryker disable next-line ConditionalExpression,StringLiteral: a node that is no identifier names no constant, under whatever key it is looked up
    const name = value.type === 'Identifier' ? (value.name ?? '') : '';
    const init = constants.get(name) ?? null;

    return !seen.has(name) && init !== null && isValue(init, constants, new Set([...seen, name]));
}

function isChainReported({ awaited, call, method, parent }: Chain, constants: Constants): boolean {
    const [fallback, ...rest] = call.arguments ?? [];
    const isNoPromise =
        method === 'catch' &&
        fallback !== undefined &&
        rest.length === 0 &&
        isValue(fallback, constants, new Set());

    return !isNoPromise && !awaited && !HANDED_ON.has(parent.type);
}

export const promiseIsAwaited = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'promises',
            fix: WHY_FIX.fix,
            name: PROMISE_IS_AWAITED_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${PROMISE_IS_AWAITED_NAME}`))?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            chained: {
                fix: WHY_FIX.fix,
                found: 'a `.{{method}}()` chain where `await` reads the promise',
            },
            iife: {
                fix: 'await at the module’s top level: an ES module awaits there, with no function to wrap it',
                found: 'an async function called where it is declared, at the module’s top level',
            },
        },
        read: 'docs/reference/lint-presets.md#a-promise-is-awaited',
        type: 'suggestion',
    },
    {
        create(context: RuleContext): Record<string, (program: Node) => void> {
            return {
                Program(program: Node): void {
                    const { chains, constants } = readOf(program);
                    for (const chain of chains.filter((one) => isChainReported(one, constants))) {
                        context.report({
                            data: { method: chain.method },
                            messageId: 'chained',
                            node: chain.call,
                        });
                    }
                    for (const statement of (program.body ?? []).filter((item) =>
                        isAsyncIife(item),
                    )) {
                        context.report({ messageId: 'iife', node: statement });
                    }
                },
            };
        },
    },
);
