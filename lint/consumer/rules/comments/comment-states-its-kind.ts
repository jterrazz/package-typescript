import { defineRule } from '../../../kit/catalogue/rule.js';
import {
    COMMENT_KIND_OPENING,
    COMMENT_KINDS,
    LANGUAGE_TAGS,
} from '../../catalogue/comment-kinds.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };
import { hoversOf } from './comment-states-its-kind.hovers.js';
import type { AstNode } from './comment-states-its-kind.hovers.js';

type Comment = {
    end: number;
    start: number;
    type: 'Block' | 'Line' | 'Shebang';
    value: string;
};

type Fixer = {
    removeRange: (range: readonly [number, number]) => unknown;
};

type SourceCode = { getAllComments: () => Comment[]; text: string };

type Options = { openings: readonly string[] };

type RuleContext = {
    options: readonly [Options];
    report: (report: { fix?: (fixer: Fixer) => unknown; messageId: string; node: Comment }) => void;
    sourceCode: SourceCode;
};

type Run = { first: Comment; last: Comment };

export const COMMENT_STATES_ITS_KIND_NAME = 'comment-states-its-kind';

const TOOL_INSTRUCTION =
    /^(?:(?:es|ox)lint-(?:disable|enable)|@ts-|biome-ignore|(?:oxfmt|prettier|dprint)-ignore\b|(?:v8|c8|istanbul|node:coverage) ignore\b|@vite-ignore\b|webpack[A-Z]|Stryker (?:disable|restore)\b|[#@]__PURE__|@__NO_SIDE_EFFECTS__|@jsx|@vitest-environment\b|type-coverage:|<reference )/u;

// Stryker disable next-line StringLiteral: the tags are ASCII words, so the unicode flag changes nothing the pattern matches
const LANGUAGE_TAG = new RegExp(`^\\s*(?:${LANGUAGE_TAGS.join('|')})\\s*$`, 'u');

// Stryker disable next-line StringLiteral: the kinds are ASCII words, so the unicode flag changes nothing the pattern matches
const KIND_IN_INSTRUCTION = new RegExp(`(?<=(?::|--) )(?:${COMMENT_KINDS.join('|')}): `, 'u');

const GENERATED = /@generated\b/u;

const GENERATED_HEAD_LINES = 5;

const LINE_BREAK_THEN_INDENT = /^\r?\n[ \t]*$/u;

const BLANK_TO_LINE_END = /^[^\S\n]*\n/u;

const BEFORE_TEMPLATE = /^\s*`/u;

// Stryker disable next-line Regex: each line is trimmed after its margin goes, so the margin's own spaces are the trim's too
const HOVER_LINE_MARGIN = /^\s*\*?\s?/u;

const BLOCK_TAG = /^@[a-zA-Z]+\b/u;

const WHY_FIX = {
    fix: `delete it, rename what needed it, or — when it annotates a literal — name the value with a constant; a comment that states what the code cannot opens with its kind — ${COMMENT_KINDS.map((kind) => `\`${kind}:\``).join(', ')} — and an exported symbol's editor hover is one \`/** … */\` paragraph above it, its block tags — \`@param\`, \`@example\` — on the lines after it`,
    why: 'the default is no comment — the code speaks through its names, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one',
};

const openingOf = (comment: Comment): string => comment.value.replace(/[\s*/]*/u, '');

const blanksAfter = (text: string, from: number): number => {
    const rest = text.slice(from);

    return from + rest.length - rest.trimStart().length;
};

// invariant: a directive between a hover and its declaration leaves it the declaration's, as the editor reads it.
function nextTokenAt(text: string, from: number, comments: readonly Comment[]): number {
    let at = blanksAfter(text, from);
    for (const comment of comments) {
        if (comment.start === at) {
            at = blanksAfter(text, comment.end);
        }
    }

    return at;
}

const proseOf = (line: string): string => line.replace(HOVER_LINE_MARGIN, '').trim();

// invariant: a hover's prose is one paragraph, wrapped as the formatter's width asks; what follows it from its first block tag on (`@param`, `@returns`, `@example` and its code) is the tags' own, an editor and typedoc render as the published symbol's documentation.
function isOneParagraph(value: string): boolean {
    const lines = value.split('\n').map((line) => proseOf(line));
    const firstTag = lines.findIndex((line) => BLOCK_TAG.test(line));
    // Stryker disable next-line ConditionalExpression,UnaryOperator: the last line of a hover's value is the blank before its closing, which a trimmed prose never counts, so dropping it where no tag stands changes nothing
    const prose = (firstTag === -1 ? lines : lines.slice(0, firstTag)).join('\n').trim();

    return !prose.includes('\n\n');
}

function isHoverPlace(
    comment: Comment,
    text: string,
    targets: ReadonlySet<number>,
    comments: readonly Comment[],
): boolean {
    return (
        comment.type === 'Block' &&
        comment.value.startsWith('*') &&
        BLANK_TO_LINE_END.test(text.slice(comment.end)) &&
        targets.has(nextTokenAt(text, comment.end, comments))
    );
}

function isLanguageTag(comment: Comment, text: string): boolean {
    return (
        comment.type === 'Block' &&
        LANGUAGE_TAG.test(comment.value) &&
        BEFORE_TEMPLATE.test(text.slice(comment.end))
    );
}

function runsOf(comments: readonly Comment[], text: string): Run[] {
    const runs: Run[] = [];
    let current: Run | undefined;
    for (const comment of comments) {
        if (
            current?.last.type === 'Line' &&
            comment.type === 'Line' &&
            LINE_BREAK_THEN_INDENT.test(text.slice(current.last.end, comment.start))
        ) {
            current.last = comment;
        } else {
            current = { first: comment, last: comment };
            runs.push(current);
        }
    }

    return runs;
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
        fixable: 'code',
        messages: {
            paragraphedHover: {
                fix: "keep one paragraph in the hover — an exported symbol's hover says what it is, wrapped at the formatter's width with no blank line, and its block tags follow on lines of their own; the rest is a `docs/` page",
                found: "an exported symbol's hover of several paragraphs",
            },
            kindedInstruction: {
                fix: 'drop the kind: a tool instruction is its own kind, and its reason follows it bare — `typescript fix` drops it',
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
        create(context: RuleContext): Record<string, (program: AstNode) => void> {
            const { sourceCode } = context;
            const { openings } = context.options[0];

            const isStructure = (opening: string): boolean =>
                TOOL_INSTRUCTION.test(opening) ||
                openings.some((declared) => opening.startsWith(declared));

            return {
                Program(program: AstNode): void {
                    const { text } = sourceCode;
                    const head = text.split('\n', GENERATED_HEAD_LINES);
                    if (head.some((line) => GENERATED.test(line))) {
                        return;
                    }
                    const { targets } = hoversOf(program);
                    const comments = sourceCode
                        .getAllComments()
                        .filter((comment) => comment.type !== 'Shebang');
                    for (const run of runsOf(comments, text)) {
                        const { first: comment } = run;
                        const opening = openingOf(comment);
                        const kinded = KIND_IN_INSTRUCTION.exec(comment.value);
                        if (TOOL_INSTRUCTION.test(opening) && kinded !== null) {
                            const at = comment.start + 2 + kinded.index;
                            context.report({
                                fix: (fixer) => fixer.removeRange([at, at + kinded[0].length]),
                                messageId: 'kindedInstruction',
                                node: comment,
                            });
                        } else if (isStructure(opening) || COMMENT_KIND_OPENING.test(opening)) {
                            // invariant: a structure or a kinded opening is no prose, and is not judged.
                        } else if (isHoverPlace(comment, text, targets, comments)) {
                            if (!isOneParagraph(comment.value)) {
                                context.report({ messageId: 'paragraphedHover', node: comment });
                            }
                        } else if (!isLanguageTag(comment, text)) {
                            context.report({ messageId: 'unstated', node: comment });
                        }
                    }
                },
            };
        },
    },
);
