import { join } from 'node:path';

import { defineCheck, rowNamed } from '../../kit/catalogue/rule.js';
import { filesKeptByteForByte } from '../../kit/checker/kept-files.js';
import type { Finding, Pass } from '../../kit/checker/pass.js';
import {
    commentDeletion,
    isCommentedElsewhere,
    STYLE_COMMENTED,
} from '../../kit/project/comments.js';
import { readText } from '../../kit/project/project-files.js';
import { COMMENT_KIND_OPENING } from '../catalogue/comment-kinds.js';
import FINDINGS from '../catalogue/findings.json' with { type: 'json' };
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
    fix: 'delete it, or open it with its kind — `invariant:`, `hazard:`, `outside:`, `value:`; `typescript fix` deletes it, and the diff gives back a line worth its kind',
    found: 'a comment that states no kind',
};

const GENERATED = /@generated\b/u;

const GENERATED_HEAD_LINES = 5;

// outside: what another tool reads in a `#` line — a linter's switch, a schema hint, a Dockerfile parser directive.
const HASH_INSTRUCTION =
    /^(?:shellcheck |yamllint |hadolint |(?:oxfmt|prettier|dprint)-ignore\b|zizmor:|checkov:|nosec\b|noqa\b|renovate:|gitleaks:allow|trunk-ignore|syntax=|escape=|check=|yaml-language-server:|@schema\b|\$schema\b|(?:end)?region\b|cspell:|codespell:)/u;

function languageOf(path: string): Language | undefined {
    if (!isCommentedElsewhere(path)) {
        return undefined;
    }

    return STYLE_COMMENTED.test(path)
        ? (text) => commentsOfStyles(text, path)
        : (text) => commentsOfHashes(text, path);
}

function isStructure(run: Run): boolean {
    return (
        COMMENT_KIND_OPENING.test(run.opening) ||
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
        const writes: { path: string; text: string }[] = [];
        const rewritten: string[] = [];
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
            const unstated = language(text).filter((run) => !isStructure(run));
            for (const run of unstated) {
                findings.push({
                    ...CHECK.finding({ path, ...positionOf(text, run.start) }, TEACHING),
                    fixed: true,
                });
            }
            if (context.fix && unstated.length > 0) {
                let kept = text;
                for (const [start, end] of unstated
                    .map((run) => commentDeletion(text, [run.start, run.end]))
                    .toReversed()) {
                    kept = `${kept.slice(0, start)}${kept.slice(end)}`;
                }
                rewritten.push(path);
                writes.push({ path: join(context.root, path), text: kept });
            }
        }

        return {
            after: rewritten.map(
                (path) => `${path} rewritten — the comments that stated no kind are deleted`,
            ),
            findings,
            writes,
        };
    },
});
