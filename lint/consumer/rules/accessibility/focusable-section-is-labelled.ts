import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    attributes: Node[];
    end: number;
    name: { name?: unknown };
    start: number;
    type: string;
};

type RuleContext = {
    report: (report: { messageId: string; node: Node }) => void;
};

export const FOCUSABLE_SECTION_IS_LABELLED_NAME = 'focusable-section-is-labelled';

const LABELS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby']);

const WHY_FIX = {
    fix: 'name the region it scrolls with `aria-label` or `aria-labelledby`, or drop its `tabIndex`',
    why: 'a `<section>` is a region only when it is labelled; the rulebook lets a section take `tabIndex={0}` so a scrolling region is reachable by the keyboard, and an unlabelled one is a stray tab stop a screen reader announces as nothing',
};

export const focusableSectionIsLabelled = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'accessibility',
            fix: WHY_FIX.fix,
            name: FOCUSABLE_SECTION_IS_LABELLED_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${FOCUSABLE_SECTION_IS_LABELLED_NAME}`))
                    ?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            unlabelled: {
                fix: WHY_FIX.fix,
                found: 'a `<section>` that takes the keyboard’s focus and names no region',
            },
        },
        read: 'docs/reference/lint-presets.md#a-focusable-section-is-labelled',
        type: 'problem',
    },
    {
        create(context: RuleContext): Record<string, (element: Node) => void> {
            return {
                JSXOpeningElement(element: Node): void {
                    const { attributes } = element;
                    // invariant: a spread may carry the label, which only its caller can tell.
                    if (
                        element.name.name !== 'section' ||
                        attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute')
                    ) {
                        return;
                    }
                    // invariant: a namespaced attribute (`xlink:href`) names an object, which no label or `tabIndex` equals.
                    const names = new Set(attributes.map((attribute) => attribute.name.name));
                    if (names.has('tabIndex') && ![...LABELS].some((label) => names.has(label))) {
                        context.report({ messageId: 'unlabelled', node: element });
                    }
                },
            };
        },
    },
);
