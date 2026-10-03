import { dirname, join, resolve } from 'node:path';

import type { Context, Finding, Pass, Tool } from '../../kit/checker/pass.js';
import { isGitIgnored, readText } from '../../kit/project/project-files.js';

type Found = { message: string; rule: string };

const PROSE_BLOCK_LIMIT = 12;

const FENCE_RUN_LIMIT = 15;

const SECTION_PROSE_LIMIT = 30;

// A skill ships beside its package's `docs/`, so a chapter it names resolves there.
const CHAPTER = /(?<![\w/.-])docs\/(?<chapter>\d{2}-[a-z\d-]+\.md)/gu;

const SKILL_PAGE = /^(?<root>(?:.*\/)?)skills\/[^/]+\/.+\.md$/u;

const OWN_RUMDL_CONFIGS = ['.rumdl.toml', 'rumdl.toml'];

// The opening segments are closed on purpose, or every `a/b` in a sentence would read as a
// coordinate; `docs/` and `src/` are absent because a page teaching a convention names the reader's tree.
const BACKTICK_PATH =
    /`(?<path>(?:apps|bin|lib|lint|packages|presets|specs|tests)\/[a-zA-Z\d._/-]+)`/gu;

const withoutFences = (markdown: string): string => markdown.replaceAll(/^```.*?^```/gmsu, '');

const FRONTMATTER = /^---\n.*?\n---\n/su;
const FENCE = /^\s*(?:```|~~~)/u;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/u;
const TABLE_ROW = /^\s*\|/u;
const HEADING = /^(?<hashes>#{1,6})\s/u;

function linesWithFrontmatterBlanked(markdown: string): string[] {
    return markdown.replace(FRONTMATTER, (block) => block.replaceAll(/[^\n]/gu, '')).split('\n');
}

function longProseBlocks(markdown: string): string[] {
    let inFence = false;
    let length = 0;
    let start = 0;
    const found: string[] = [];
    const close = (): void => {
        if (length > PROSE_BLOCK_LIMIT) {
            found.push(
                `a block of ${length} lines at line ${start} — the floor is ${PROSE_BLOCK_LIMIT}`,
            );
        }
        length = 0;
    };

    for (const [index, line] of linesWithFrontmatterBlanked(markdown).entries()) {
        if (FENCE.test(line)) {
            close();
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        if (line.trim() === '' || HEADING.test(line) || TABLE_ROW.test(line)) {
            close();
            continue;
        }
        if (LIST_ITEM.test(line)) {
            close();
        }
        if (length === 0) {
            start = index + 1;
        }
        length += 1;
    }
    close();

    return found;
}

function airlessFences(markdown: string): string[] {
    let inFence = false;
    let fenceStart = 0;
    let run = 0;
    const found: string[] = [];
    const close = (): void => {
        if (run > FENCE_RUN_LIMIT) {
            found.push(
                `a fenced block at line ${fenceStart} runs ${run} lines unbroken — the floor is ${FENCE_RUN_LIMIT}`,
            );
        }
        run = 0;
    };

    for (const [index, line] of linesWithFrontmatterBlanked(markdown).entries()) {
        if (FENCE.test(line)) {
            if (inFence) {
                close();
            } else {
                fenceStart = index + 1;
                run = 0;
            }
            inFence = !inFence;
            continue;
        }
        if (!inFence) {
            continue;
        }
        if (line.trim() === '') {
            close();
            continue;
        }
        run += 1;
    }
    close();

    return found;
}

function flatSections(markdown: string): string[] {
    let inFence = false;
    let title = '';
    let start = 0;
    let prose = 0;
    let broken = false;
    const found: string[] = [];
    const close = (): void => {
        if (title !== '' && !broken && prose > SECTION_PROSE_LIMIT) {
            found.push(
                `"${title}" at line ${start} runs ${prose} lines of prose with no ### and no list`,
            );
        }
    };

    for (const [index, line] of linesWithFrontmatterBlanked(markdown).entries()) {
        if (FENCE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading !== null) {
            const level = (heading.groups?.hashes ?? '').length;
            if (level <= 2) {
                close();
                // An h1 titles the page; it is not one of its questions.
                title = level === 2 ? line.trim() : '';
                start = index + 1;
                prose = 0;
                broken = false;
            } else {
                broken = true;
            }
            continue;
        }
        if (LIST_ITEM.test(line)) {
            broken = true;
            continue;
        }
        if (line.trim() !== '' && !TABLE_ROW.test(line)) {
            prose += 1;
        }
    }
    close();

    return found;
}

const DECISION_RECORD = /(?:^|\/)docs\/decisions\/[^/]+\.md$/u;

function missingPaths({ exists, root }: Context, path: string, cited: string): Found[] {
    if (DECISION_RECORD.test(path)) {
        return [];
    }
    const found: Found[] = [];
    for (const match of cited.matchAll(BACKTICK_PATH)) {
        const target = (match.groups?.path ?? '').replace(/\/$/u, '');
        if (
            !exists(join(root, target)) &&
            !exists(resolve(root, dirname(path), target)) &&
            !isGitIgnored(root, target)
        ) {
            found.push({
                message: `\`${target}\` names nothing on disk`,
                rule: 'markdown/path-resolves',
            });
        }
    }

    return found;
}

function missingChapters({ exists, root }: Context, path: string, cited: string): Found[] {
    const skill = SKILL_PAGE.exec(path);
    if (skill === null) {
        return [];
    }

    const found: Found[] = [];
    for (const match of cited.matchAll(CHAPTER)) {
        const chapter = match.groups?.chapter ?? '';
        if (!exists(join(root, skill.groups?.root ?? '', 'docs', chapter))) {
            found.push({
                message: `docs/${chapter} is no chapter this package ships`,
                rule: 'markdown/chapter-reference-resolves',
            });
        }
    }

    return found;
}

function auditPage(context: Context, path: string, markdown: string): Found[] {
    const cited = withoutFences(markdown);
    const found = [...missingPaths(context, path, cited), ...missingChapters(context, path, cited)];

    for (const reason of longProseBlocks(markdown)) {
        found.push({ message: reason, rule: 'markdown/prose-block-is-short' });
    }
    for (const reason of airlessFences(markdown)) {
        found.push({ message: reason, rule: 'markdown/fenced-run-is-short' });
    }
    for (const reason of flatSections(markdown)) {
        found.push({ message: reason, rule: 'markdown/long-section-has-subheadings' });
    }

    return found;
}

function rumdl(context: Context, pages: readonly string[]): Tool[] {
    if (pages.length === 0) {
        return [];
    }
    const own = OWN_RUMDL_CONFIGS.some((name) => context.exists(join(context.root, name)));

    return [
        {
            args: [
                'check',
                '--no-cache',
                '--quiet',
                ...(own ? [] : ['--config', context.value('--rumdl-config', '')]),
                ...(context.fix ? ['--fix'] : []),
                ...pages,
            ],
            flag: '--rumdl',
            name: 'rumdl',
        },
    ];
}

export const markdown: Pass = Object.freeze({
    check(context) {
        const findings: Finding[] = [];
        const pages = context.files().filter((file) => file.endsWith('.md'));
        for (const path of pages) {
            const text = readText(context.root, path);
            if (text !== null) {
                findings.push(
                    ...auditPage(context, path, text).map(({ message, rule }) => ({
                        message,
                        path,
                        rule,
                    })),
                );
            }
        }

        return { findings, tools: rumdl(context, pages) };
    },
    valued: ['--rumdl', '--rumdl-config'],
});
