import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    arguments?: Node[];
    callee?: Node;
    computed?: boolean;
    end: number;
    key?: Node;
    name?: string;
    properties?: Node[];
    property?: Node;
    start: number;
    type: string;
    value?: unknown;
};

type Call = Node & { arguments: Node[]; callee: Node };

type RuleContext = {
    report: (report: { data: Record<string, string>; messageId: string; node: Node }) => void;
};

export const ACCESSIBLE_ELEMENT_IS_JSX_NAME = 'accessible-element-is-jsx';

const ACCESSIBLE_PROP = /^(?:role|tabIndex|aria-[a-z]+)$/u;

const WHY_FIX = {
    fix: 'write the element in JSX, one branch per tag when it is polymorphic, so jsx-a11y reads its props, and state any exception as a reasoned `oxlint-disable-next-line` the Suppressions pass counts',
    why: 'jsx-a11y reads the props of a JSX element and never the object handed to `createElement`, so a role, a tab stop or an aria attribute set there escapes every accessibility rule, and an exception to them hides from the Suppressions pass and the drift report',
};

// invariant: `registry['createElement']` holds its name in a literal, never an identifier, so it is no call of it.
const isCreateElement = (callee: Node): boolean =>
    (callee.property ?? callee).name === 'createElement';

// invariant: a computed key (`[key]: 0`) and a spread name no prop the rule can read.
function keyOf(property: Node): string {
    const { key } = property;
    // Stryker disable StringLiteral: a key the rule cannot read is a name no accessibility prop matches, whatever it is spelt
    return property.computed === true
        ? ''
        : (key?.name ?? (typeof key?.value === 'string' ? key.value : ''));
    // Stryker restore StringLiteral
}

export const accessibleElementIsJsx = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'accessibility',
            fix: WHY_FIX.fix,
            name: ACCESSIBLE_ELEMENT_IS_JSX_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${ACCESSIBLE_ELEMENT_IS_JSX_NAME}`))
                    ?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            hidden: {
                fix: WHY_FIX.fix,
                found: '`{{prop}}` set through `createElement`, where jsx-a11y cannot read it',
            },
        },
        read: 'docs/reference/lint-presets.md#an-accessible-element-is-written-in-jsx',
        type: 'problem',
    },
    {
        create(context: RuleContext): Record<string, (call: Call) => void> {
            return {
                CallExpression(call: Call): void {
                    const properties = call.arguments[1]?.properties;
                    if (!isCreateElement(call.callee) || properties === undefined) {
                        return;
                    }
                    for (const property of properties) {
                        const prop = keyOf(property);
                        if (ACCESSIBLE_PROP.test(prop)) {
                            context.report({ data: { prop }, messageId: 'hidden', node: property });
                        }
                    }
                },
            };
        },
    },
);
