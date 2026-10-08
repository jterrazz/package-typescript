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
    local?: Node;
    name?: string;
    object?: Node;
    property?: Node;
    source?: Node;
    specifiers?: Node[];
    start: number;
    type: string;
    value?: unknown;
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

// outside: zod's import, whose schemas take a fallback in `.catch()` — a value, or a function returning one.
const SCHEMA_SOURCE = /^zod(?:\/|$)/u;

// invariant: a constant is named in capitals — `DEFAULT_LANGUAGE`, an enum's `Language.En` — and a function never is.
const CONSTANT_NAME = /^[A-Z][A-Z\d_]*$/u;

const MEMBER_CONSTANT_NAME = /^[A-Z]/u;

const WRAPPERS: ReadonlySet<string> = new Set([
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
]);

// invariant: an expression's functions alone: a declaration is never called where it is declared, nor sits inside an `await`.
const FUNCTIONS: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

const WHY_FIX = {
    fix: 'await the promise, inside a `try`/`catch` for its failure; a call that only shares the name — a zod schema’s `.catch(fallback)` — is read as no promise when the schema is built from zod’s import in the file, or when its fallback is a value: a literal, a constant named in capitals (`DEFAULT_LANGUAGE`, `Language.En`), or a `const` naming one',
    why: 'the estate writes `await`: a promise read top to bottom, its failure caught where a `try` says so, never a chain of callbacks threading the value through',
};

type Chain = { awaited: boolean; call: Node; method: string; parent: Node };

type Constants = Map<string | undefined, Node | null>;

type Read = { constants: Constants; schemas: ReadonlySet<string> };

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

// Stryker disable OptionalChaining,ArrayDeclaration: a program holds its body, an import its source and its specifiers, each its local name
function schemaImportsOf(program: Node): Set<string> {
    return new Set(
        (program.body ?? [])
            .filter(
                (statement) =>
                    statement.type === 'ImportDeclaration' &&
                    SCHEMA_SOURCE.test(String(statement.source?.value)),
            )
            .flatMap((statement) => statement.specifiers ?? [])
            .map((specifier) => String(specifier.local?.name)),
    );
}
// Stryker restore OptionalChaining,ArrayDeclaration

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

// invariant: of the expressions a fallback is, an identifier alone holds a `name`.
function isNamedConstant(value: Node): boolean {
    if (value.type === 'MemberExpression') {
        // Stryker disable next-line OptionalChaining: a member holds its property
        return value.computed !== true && MEMBER_CONSTANT_NAME.test(String(value.property?.name));
    }

    return CONSTANT_NAME.test(String(value.name));
}

function isValue(node: Node, constants: Constants, seen: ReadonlySet<string>): boolean {
    const value = unwrapped(node);
    if (VALUES.has(value.type) || value.name === 'undefined' || isNamedConstant(value)) {
        return true;
    }
    // Stryker disable next-line ConditionalExpression,StringLiteral: a node that is no identifier names no constant, under whatever key it is looked up
    const name = value.type === 'Identifier' ? (value.name ?? '') : '';
    const init = constants.get(name) ?? null;

    return !seen.has(name) && init !== null && isValue(init, constants, new Set([...seen, name]));
}

function rootOf(node: Node): Node {
    const inner = unwrapped(node);
    const next = inner.type === 'CallExpression' ? inner.callee : inner.object;

    return next === undefined ? inner : rootOf(next);
}

// invariant: a receiver rooted in zod's import — `z.string()`, or a `const` holding a schema built from it — is a schema, never a promise.
function isSchema(node: Node, read: Read, seen: ReadonlySet<string>): boolean {
    const name = String(rootOf(node).name);
    if (read.schemas.has(name)) {
        return true;
    }
    const init = read.constants.get(name) ?? null;

    return !seen.has(name) && init !== null && isSchema(init, read, new Set([...seen, name]));
}

function isChainReported({ awaited, call, method, parent }: Chain, read: Read): boolean {
    const [fallback, ...rest] = call.arguments ?? [];
    const isNoPromise =
        method === 'catch' &&
        fallback !== undefined &&
        rest.length === 0 &&
        (isValue(fallback, read.constants, new Set()) || isSchema(call, read, new Set()));

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
                    const read = { constants, schemas: schemaImportsOf(program) };
                    for (const chain of chains.filter((one) => isChainReported(one, read))) {
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
