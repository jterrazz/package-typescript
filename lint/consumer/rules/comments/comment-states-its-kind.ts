import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Comment = {
    end?: number;
    range?: [number, number];
    start?: number;
    type: 'Block' | 'Line' | 'Shebang';
    value: string;
};

type SourceCode = { getAllComments: () => Comment[]; text: string };

type Options = { openings?: readonly string[] };

type RuleContext = {
    options: readonly (Options | undefined)[];
    report: (report: { messageId: string; node: Comment }) => void;
    sourceCode: SourceCode;
};

export const COMMENT_STATES_ITS_KIND_NAME = 'comment-states-its-kind';

export const COMMENT_KINDS: readonly string[] = Object.freeze([
    'invariant',
    'hazard',
    'outside',
    'value',
]);

const KIND = new RegExp(`^(?:${COMMENT_KINDS.join('|')}): \\S`, 'u');

const TOOL_INSTRUCTION =
    /^(?:(?:es|ox)lint-(?:disable|enable)|@ts-|biome-ignore|(?:oxfmt|prettier|dprint)-ignore\b|(?:v8|c8|istanbul|node:coverage) ignore\b|@vite-ignore\b|webpack[A-Z]|Stryker (?:disable|restore)\b|[#@]__PURE__|@__NO_SIDE_EFFECTS__|@jsx|@vitest-environment\b|type-coverage:|<reference )/u;

const TEST_MARKER = /^(?:Given|When|Then) - /u;

const GENERATED = /@generated\b/u;

const GENERATED_HEAD_LINES = 5;

const WHY_FIX = {
    fix: `delete it, or rename what needed it; a comment that states what the code cannot opens with its kind — ${COMMENT_KINDS.map((kind) => `\`${kind}:\``).join(', ')} — and a symbol's editor hover is one \`/** … */\` line`,
    why: 'the default is no comment — the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one',
};

const startOf = (comment: Comment): number => comment.range?.[0] ?? comment.start ?? 0;
const endOf = (comment: Comment): number => comment.range?.[1] ?? comment.end ?? 0;

const openingOf = (comment: Comment): string =>
    comment.value.replace(/^[\s*]*/u, '').replace(/^\/\s*/u, '');

function isHover(comment: Comment, text: string): boolean {
    if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
        return false;
    }
    const body = text.slice(startOf(comment), endOf(comment));
    const after = text.slice(endOf(comment), text.indexOf('\n', endOf(comment)) + 1 || undefined);

    return !body.includes('\n') && after.trim() === '';
}

function startsItsLine(comment: Comment, text: string): boolean {
    const lineStart = text.lastIndexOf('\n', startOf(comment) - 1) + 1;

    return text.slice(lineStart, startOf(comment)).trim() === '';
}

function runsOf(comments: readonly Comment[], text: string): Comment[] {
    const openings: Comment[] = [];
    let previous: Comment | undefined;
    for (const comment of comments) {
        const between =
            previous === undefined ? null : text.slice(endOf(previous), startOf(comment));
        const continues =
            previous?.type === 'Line' &&
            comment.type === 'Line' &&
            between !== null &&
            /^[ \t]*\r?\n[ \t]*$/u.test(between) &&
            startsItsLine(comment, text);
        if (!continues) {
            openings.push(comment);
        }
        previous = comment;
    }

    return openings;
}

export const commentStatesItsKind = defineRule(
    {
        defaultOptions: [{ openings: [] }],
        docs: {
            audience: 'consumer',
            family: 'comments',
            fix: WHY_FIX.fix,
            name: COMMENT_STATES_ITS_KIND_NAME,
            sentence:
                FINDINGS.find(({ id }) => id.endsWith(`/${COMMENT_STATES_ITS_KIND_NAME}`))
                    ?.sentence ?? '',
            why: WHY_FIX.why,
        },
        messages: {
            unstated: {
                fix: WHY_FIX.fix,
                found: 'a comment that states no kind',
            },
        },
        read: 'docs/08-lint-presets.md#a-comment-states-its-kind',
        schema: [
            {
                additionalProperties: false,
                properties: { openings: { items: { type: 'string' }, type: 'array' } },
                type: 'object',
            },
        ],
        type: 'suggestion',
    },
    {
        create(context: RuleContext): Record<string, () => void> {
            const { sourceCode } = context;
            const openings = context.options[0]?.openings ?? [];

            const isStructure = (opening: string): boolean =>
                TOOL_INSTRUCTION.test(opening) ||
                TEST_MARKER.test(opening) ||
                openings.some((declared) => opening.startsWith(declared));

            return {
                Program(): void {
                    const { text } = sourceCode;
                    const head = text.split('\n', GENERATED_HEAD_LINES).join('\n');
                    if (GENERATED.test(head)) {
                        return;
                    }
                    const comments = sourceCode
                        .getAllComments()
                        .filter((comment) => comment.type !== 'Shebang');
                    for (const comment of runsOf(comments, text)) {
                        const opening = openingOf(comment);
                        if (
                            !isStructure(opening) &&
                            !KIND.test(opening) &&
                            !isHover(comment, text)
                        ) {
                            context.report({ messageId: 'unstated', node: comment });
                        }
                    }
                },
            };
        },
    },
);
