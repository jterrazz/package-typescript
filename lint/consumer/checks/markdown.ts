import { dirname, join, resolve } from 'node:path';

import { filesKeptByteForByte } from '../../kit/checker/kept-files.js';
import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import { isGitIgnored, readText } from '../../kit/project/project-files.js';
import { airlessFences, FENCE, linesWithFrontmatterBlanked } from './markdown.fences.js';
import { QUALIFIED_BY_REPOSITORY, unlinkedReferences, withoutGenerated } from './markdown.parts.js';
import { brokenLinks, rumdl } from './markdown.rumdl.js';

type Found = { message: string; rule: string };

const PROSE_BLOCK_LIMIT = 12;

const SECTION_PROSE_LIMIT = 30;

// invariant: a skill ships beside its package's `docs/`, so a page it names resolves there.
const PAGE = /(?<![\w/.-])docs\/(?<page>(?:start|guides|concepts|reference)\/[a-z\d-]+\.md)/gu;

const SKILL_PAGE = /^(?<root>(?:.*\/)?)skills\/[^/]+\/.+\.md$/u;

// invariant: the opening segments are closed on purpose, or every `a/b` in a sentence would read as a
// coordinate; `docs/` and `src/` are absent because a page teaching a convention names the reader's tree.
const BACKTICK_PATH =
    /`(?<path>(?:apps|bin|lib|lint|packages|presets|specs|tests)\/[a-zA-Z\d._/-]+)`/gu;

const withoutFences = (markdown: string): string => markdown.replaceAll(/^```.*?^```/gmsu, '');

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/u;
const TABLE_ROW = /^\s*\|/u;
const HEADING = /^(?<hashes>#{1,6})\s/u;

function longProseBlocks(markdown: string): string[] {
    let inFence = false;
    let length = 0;
    let start = 0;
    const found: string[] = [];
    const close = (): void => {
        if (length > PROSE_BLOCK_LIMIT) {
            found.push(
                `a block of ${length} lines at line ${start}, over the limit of ${PROSE_BLOCK_LIMIT}`,
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
                // invariant: an h1 titles the page; it is not one of its questions.
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

// invariant: a numbered record under any `decisions/` folder is frozen like the manual's own: its body names the paths of its day.
const NUMBERED_RECORD = /(?:^|\/)decisions\/\d{3}-[^/]+\.md$/u;

function missingPaths({ exists, root }: Context, path: string, cited: string): Found[] {
    if (DECISION_RECORD.test(path) || NUMBERED_RECORD.test(path)) {
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

function missingPages({ exists, root }: Context, path: string, cited: string): Found[] {
    const skill = SKILL_PAGE.exec(path);
    if (skill === null) {
        return [];
    }

    const found: Found[] = [];
    for (const match of cited.matchAll(PAGE)) {
        const page = match.groups?.page ?? '';
        if (QUALIFIED_BY_REPOSITORY.test(cited.slice(0, match.index))) {
            continue;
        }
        if (!exists(join(root, skill.groups?.root ?? '', 'docs', page))) {
            found.push({
                message: `docs/${page} is no page this package ships`,
                rule: 'markdown/page-reference-resolves',
            });
        }
    }

    return found;
}

function auditPage(context: Context, path: string, written: string): Found[] {
    const markdown = withoutGenerated(written);
    const cited = withoutFences(markdown);
    const found = [...missingPaths(context, path, cited), ...missingPages(context, path, cited)];

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

export const markdown: Pass = Object.freeze({
    async check(context) {
        const findings: Finding[] = [];
        const isKept = await filesKeptByteForByte(context);
        const pages = context.files().filter((file) => file.endsWith('.md') && !isKept(file));
        for (const path of pages) {
            const text = readText(context.root, path);
            // Stryker disable next-line ConditionalExpression: a page the tree lists is a file on disk, which reads
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

        findings.push(
            ...unlinkedReferences(context.files(), (path) => readText(context.root, path)),
            ...brokenLinks(context, pages),
        );

        return { findings, tools: rumdl(context, pages) };
    },
    valued: ['--rumdl', '--rumdl-config'],
});
