import { defineCheck, rowNamed } from '../../kit/catalogue/rule.js';
import { filesKeptByteForByte } from '../../kit/checker/kept-files.js';
import type { Finding, Pass } from '../../kit/checker/pass.js';
import { isCommentedElsewhere, isGoFile, STYLE_COMMENTED } from '../../kit/project/comments.js';
import { readText } from '../../kit/project/project-files.js';
import { COMMENT_KIND_OPENING } from '../catalogue/comment-kinds.js';
import FINDINGS from '../catalogue/findings.json' with { type: 'json' };
import { commentsOfGo, GO_INSTRUCTION } from './comments.go.js';
import { commentsOfHashes } from './comments.hashes.js';
import { commentsOfStyles } from './comments.styles.js';

export type Run = { end: number; opening: string; start: number };

type Language = (text: string) => Run[];

const ROW = rowNamed(
    // Stryker disable next-line MethodExpression,ConditionalExpression,EqualityOperator: the row lends its sentence, which no lesson of this pass prints
    FINDINGS.filter(({ id }) => id === 'comments/comment-states-its-kind').map((row) => ({
        ...row,
        name: 'comment-states-its-kind',
    })),
    'comment-states-its-kind',
);

const CHECK = defineCheck({
    docs: {
        ...ROW,
        why: 'the default is no comment — a script, a style sheet or a workflow speaks through its names as code does, and a comment is kept only for what they cannot say: an invariant, a hazard, a constraint from outside the codebase, why a value is this one',
    },
    namespace: 'comments',
    read: 'docs/reference/lint-presets.md#a-comment-states-its-kind',
});

const TEACHING = {
    fix: 'delete it, or open it with its kind — `invariant:`, `hazard:`, `outside:`, `value:`',
    found: 'a comment that states no kind',
};

const GENERATED = /@generated\b|Code generated .* DO NOT EDIT/u;

const GENERATED_HEAD_LINES = 5;

// outside: what another tool reads in a `#` line — a linter's switch, a schema hint, a Dockerfile parser directive, @jterrazz/test's checker directive in a spec document.
const HASH_INSTRUCTION =
    /^(?:shellcheck |yamllint |hadolint |(?:oxfmt|prettier|dprint)-ignore\b|zizmor:|checkov:|nosec\b|noqa\b|renovate:|gitleaks:allow|trunk-ignore|syntax=|escape=|check=|yaml-language-server:|@schema\b|\$schema\b|(?:end)?region\b|cspell:|codespell:|checker-disable(?:-next-line|-line)?\b)/u;

function languageOf(path: string): Language | undefined {
    if (!isCommentedElsewhere(path)) {
        return undefined;
    }
    if (isGoFile(path)) {
        return commentsOfGo;
    }

    return STYLE_COMMENTED.test(path)
        ? (text) => commentsOfStyles(text, path)
        : (text) => commentsOfHashes(text, path);
}

function isStructure(run: Run): boolean {
    return (
        COMMENT_KIND_OPENING.test(run.opening) ||
        GO_INSTRUCTION.test(run.opening) ||
        HASH_INSTRUCTION.test(run.opening) ||
        run.opening.startsWith('!') ||
        /^(?:stylelint-(?:disable|enable)|biome-ignore|purgecss |rtl:|autoprefixer:|webpackIgnore:)/u.test(
            run.opening,
        )
    );
}

function positionOf(text: string, offset: number): { column: number; line: number } {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;

    return { column: offset - (before.lastIndexOf('\n') + 1) + 1, line };
}

export const comments: Pass = Object.freeze({
    async check(context) {
        const findings: Finding[] = [];
        const isKept = await filesKeptByteForByte(context);
        const read = context.files().flatMap((path) => {
            const language = isKept(path) ? undefined : languageOf(path);

            return language === undefined ? [] : [{ language, path }];
        });
        for (const { language, path } of read) {
            const text = readText(context.root, path) ?? '';
            if (text.split('\n', GENERATED_HEAD_LINES).some((line) => GENERATED.test(line))) {
                continue;
            }
            for (const run of language(text).filter((one) => !isStructure(one))) {
                findings.push(CHECK.finding({ path, ...positionOf(text, run.start) }, TEACHING));
            }
        }

        return { after: [], findings, writes: [] };
    },
});
