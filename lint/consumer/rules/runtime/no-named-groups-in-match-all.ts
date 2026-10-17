import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    [key: string]: unknown;
    arguments?: Node[];
    callee?: Node;
    computed?: boolean;
    id?: Node;
    init?: Node | null;
    kind?: string;
    name?: string;
    property?: Node;
    regex?: { pattern: string };
    type: string;
};

type RuleContext = {
    report: (report: { messageId: string; node: Node }) => void;
};

export const NO_NAMED_GROUPS_IN_MATCH_ALL_NAME = 'no-named-groups-in-match-all';

// invariant: `(?<name>` opens a named group; `(?<=` and `(?<!` are the look-behinds, which name nothing.
const NAMED_GROUP = /\(\?<(?![!=])/u;

const WHY_FIX = {
    fix: 'read the groups of each match with `exec` in a loop on a global pattern, or by position (`match[1]`) where the iterator is wanted; a pattern without a named group is read by `matchAll` as usual',
    why: 'Hermes, the engine an Expo app runs on, drops the named groups of the matches `String#matchAll` yields: `match.groups` is `undefined` at runtime, and the type check and every test on Node read them as the specification says',
};

const isNode = (value: unknown): value is Node =>
    typeof value === 'object' && value !== null && 'type' in value;

function childrenOf(node: Node): Node[] {
    return Object.entries(node)
        .filter(([key]) => key !== 'parent')
        .flatMap(([, value]) => [value].flat())
        .filter((value) => isNode(value));
}

const isNamed = (node: Node | undefined): boolean =>
    node?.regex !== undefined && NAMED_GROUP.test(node.regex.pattern);

// invariant: a `const` holding a pattern is the pattern wherever its name is read; a name declared twice, in two scopes, is no pattern the rule can tell.
function patternsOf(program: Node): Map<string, boolean> {
    const patterns = new Map<string, boolean>();
    const walk = (parent: Node): void => {
        for (const node of childrenOf(parent)) {
            // Stryker disable next-line ConditionalExpression,OptionalChaining: a declarator always has an id, and one with no name (a destructuring) set apart or kept sets a key no identifier reads
            if (node.type === 'VariableDeclarator' && node.id?.name !== undefined) {
                patterns.set(
                    node.id.name,
                    !patterns.has(node.id.name) && isNamed(node.init ?? undefined),
                );
            }
            walk(node);
        }
    };
    walk(program);

    return patterns;
}

function isMatchAll(node: Node): boolean {
    return (
        node.type === 'CallExpression' &&
        // Stryker disable next-line OptionalChaining: a call has a callee
        node.callee?.computed !== true &&
        // Stryker disable next-line OptionalChaining: a call has a callee
        node.callee?.property?.name === 'matchAll'
    );
}

export const noNamedGroupsInMatchAll = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'runtime',
            fix: WHY_FIX.fix,
            name: NO_NAMED_GROUPS_IN_MATCH_ALL_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${NO_NAMED_GROUPS_IN_MATCH_ALL_NAME}`))
                    ?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            named: {
                fix: WHY_FIX.fix,
                found: '`matchAll` is given a pattern with a named group, whose `match.groups` Hermes leaves undefined',
            },
        },
        read: 'docs/reference/lint-presets.md#matchall-keeps-no-named-group-on-hermes',
        type: 'problem',
    },
    {
        create(context: RuleContext): Record<string, (program: Node) => void> {
            return {
                Program(program: Node): void {
                    const patterns = patternsOf(program);
                    const walk = (parent: Node): void => {
                        for (const node of childrenOf(parent)) {
                            // Stryker disable next-line ArrayDeclaration: a call always has its arguments
                            const [pattern] = isMatchAll(node) ? (node.arguments ?? []) : [];
                            if (
                                pattern !== undefined &&
                                (isNamed(pattern) ||
                                    // Stryker disable next-line ConditionalExpression: only an identifier has a name to look up, and any other argument reads the name `undefined`, which no declaration holds
                                    (pattern.type === 'Identifier' &&
                                        patterns.get(String(pattern.name)) === true))
                            ) {
                                context.report({ messageId: 'named', node });
                            }
                            walk(node);
                        }
                    };
                    walk(program);
                },
            };
        },
    },
);
