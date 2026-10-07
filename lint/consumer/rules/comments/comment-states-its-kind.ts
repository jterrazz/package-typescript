import { defineRule } from '../../../kit/catalogue/rule.js';
import { commentDeletion } from '../../../kit/project/comments.js';
import {
    COMMENT_KIND_OPENING,
    COMMENT_KINDS,
    LANGUAGE_TAGS,
} from '../../catalogue/comment-kinds.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };
import { hoversOf } from './comment-states-its-kind.hovers.js';
import type { AstNode, Span } from './comment-states-its-kind.hovers.js';

type Comment = {
    end: number;
    start: number;
    type: 'Block' | 'Line' | 'Shebang';
    value: string;
};

type Fixer = { removeRange: (range: readonly [number, number]) => unknown };

type SourceCode = { getAllComments: () => Comment[]; text: string };

type Options = { openings: readonly string[] };

type RuleContext = {
    options: readonly [Options];
    report: (report: { fix: (fixer: Fixer) => unknown; messageId: string; node: Comment }) => void;
    sourceCode: SourceCode;
};

type Run = { first: Comment; last: Comment };

export const COMMENT_STATES_ITS_KIND_NAME = 'comment-states-its-kind';

const TOOL_INSTRUCTION =
    /^(?:(?:es|ox)lint-(?:disable|enable)|@ts-|biome-ignore|(?:oxfmt|prettier|dprint)-ignore\b|(?:v8|c8|istanbul|node:coverage) ignore\b|@vite-ignore\b|webpack[A-Z]|Stryker (?:disable|restore)\b|[#@]__PURE__|@__NO_SIDE_EFFECTS__|@jsx|@vitest-environment\b|type-coverage:|<reference )/u;

const LANGUAGE_TAG = new RegExp(`^\\s*(?:${LANGUAGE_TAGS.join('|')})\\s*$`, 'u');

const KIND_IN_INSTRUCTION = new RegExp(`(?<=(?::|--) )(?:${COMMENT_KINDS.join('|')}): `, 'u');

const GENERATED = /@generated\b/u;

const GENERATED_HEAD_LINES = 5;

const LINE_BREAK_THEN_INDENT = /^\r?\n[ \t]*$/u;

const BLANK_TO_LINE_END = /^[^\S\n]*\n/u;

const BEFORE_TEMPLATE = /^\s*`/u;

const WHY_FIX = {
    fix: `delete it, or rename what needed it; a comment that states what the code cannot opens with its kind — ${COMMENT_KINDS.map((kind) => `\`${kind}:\``).join(', ')} — and an exported symbol's editor hover is one \`/** … */\` line above it`,
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

function isHover(
    comment: Comment,
    text: string,
    targets: ReadonlySet<number>,
    comments: readonly Comment[],
): boolean {
    return (
        comment.type === 'Block' &&
        comment.value.startsWith('*') &&
        !comment.value.includes('\n') &&
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

// invariant: a directive that silences only a comment rule on the line below goes with the comment it silenced.
const COMMENT_RULE_DIRECTIVE =
    /^\s*oxlint-disable-next-line\s+jterrazz-typescript\/comment-[\w-]+(?:\s*,\s*jterrazz-typescript\/comment-[\w-]+)*\s*(?:--|$)/u;

function startOf(run: Run, text: string, comments: readonly Comment[]): number {
    const above = comments[comments.indexOf(run.first) - 1];
    if (
        above?.type === 'Line' &&
        COMMENT_RULE_DIRECTIVE.test(above.value) &&
        LINE_BREAK_THEN_INDENT.test(text.slice(above.end, run.first.start))
    ) {
        return above.start;
    }

    return run.first.start;
}

const isBlank = (text: string): boolean => text.trim() === '';

// invariant: an empty JSX container holding the run alone goes with it, so no `{}` is left among the children.
function spanOf(
    run: Run,
    text: string,
    empties: readonly Span[],
    comments: readonly Comment[],
): Span {
    const span: Span = [startOf(run, text, comments), run.last.end];
    const container = empties.find(
        ([start, end]) =>
            isBlank(text.slice(start + 1, span[0])) && isBlank(text.slice(span[1], end - 1)),
    );

    return container ?? span;
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
            kindedInstruction: {
                fix: 'drop the kind: a tool instruction is its own kind, and its reason follows it bare — `typescript fix` drops it',
                found: 'a tool instruction whose reason states a kind',
            },
            unstated: {
                fix: `${WHY_FIX.fix}; \`typescript fix\` deletes it, and the diff gives back a line worth its kind`,
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
                    const { empties, targets } = hoversOf(program);
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
                        } else if (
                            !isStructure(opening) &&
                            !COMMENT_KIND_OPENING.test(opening) &&
                            !isHover(comment, text, targets, comments) &&
                            !isLanguageTag(comment, text)
                        ) {
                            const deleted = commentDeletion(
                                text,
                                spanOf(run, text, empties, comments),
                            );
                            context.report({
                                fix: (fixer) => fixer.removeRange(deleted),
                                messageId: 'unstated',
                                node: comment,
                            });
                        }
                    }
                },
            };
        },
    },
);
