import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Comment = {
    end: number;
    start: number;
    type: 'Block' | 'Line' | 'Shebang';
    value: string;
};

type SourceCode = { getAllComments: () => Comment[]; text: string };

type Options = { openings: readonly string[] };

type RuleContext = {
    options: readonly [Options];
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

const KIND_IN_INSTRUCTION = new RegExp(`(?::|--) (?:${COMMENT_KINDS.join('|')}): `, 'u');

const GENERATED = /@generated\b/u;

const GENERATED_HEAD_LINES = 5;

const LINE_BREAK_THEN_INDENT = /^\r?\n[ \t]*$/u;

const BLANK_TO_LINE_END = /^[^\S\n]*\n/u;

const WHY_FIX = {
    fix: `delete it, or rename what needed it; a comment that states what the code cannot opens with its kind — ${COMMENT_KINDS.map((kind) => `\`${kind}:\``).join(', ')} — and a symbol's editor hover is one \`/** … */\` line`,
    why: 'the default is no comment — the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one',
};

const openingOf = (comment: Comment): string => comment.value.replace(/[\s*/]*/u, '');

function isHover(comment: Comment, text: string): boolean {
    return (
        comment.type === 'Block' &&
        comment.value.startsWith('*') &&
        !comment.value.includes('\n') &&
        BLANK_TO_LINE_END.test(text.slice(comment.end))
    );
}

function runsOf(comments: readonly Comment[], text: string): Comment[] {
    const openings: Comment[] = [];
    let previous: Comment | undefined;
    for (const comment of comments) {
        const continues =
            previous?.type === 'Line' &&
            comment.type === 'Line' &&
            LINE_BREAK_THEN_INDENT.test(text.slice(previous.end, comment.start));
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
            kindedInstruction: {
                fix: 'drop the kind: a tool instruction is its own kind, and its reason follows it bare',
                found: 'a tool instruction whose reason states a kind',
            },
            unstated: {
                fix: WHY_FIX.fix,
                found: 'a comment that states no kind',
            },
        },
        read: 'docs/reference/lint-presets.md#a-comment-states-its-kind',
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
            const { openings } = context.options[0];

            const isStructure = (opening: string): boolean =>
                TOOL_INSTRUCTION.test(opening) ||
                openings.some((declared) => opening.startsWith(declared));

            return {
                Program(): void {
                    const { text } = sourceCode;
                    const head = text.split('\n', GENERATED_HEAD_LINES);
                    if (head.some((line) => GENERATED.test(line))) {
                        return;
                    }
                    const comments = sourceCode
                        .getAllComments()
                        .filter((comment) => comment.type !== 'Shebang');
                    for (const comment of runsOf(comments, text)) {
                        const opening = openingOf(comment);
                        if (TOOL_INSTRUCTION.test(opening) && KIND_IN_INSTRUCTION.test(opening)) {
                            context.report({ messageId: 'kindedInstruction', node: comment });
                        } else if (
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
