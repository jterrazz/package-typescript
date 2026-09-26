#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, orRefused, projectFiles, readText } from '../reading/project-files.js';

const PROSE_BLOCK_LIMIT = 12;

const FENCE_RUN_LIMIT = 15;

const SECTION_PROSE_LIMIT = 30;

// A skill ships beside its package's `docs/`, so a chapter it names resolves there.
const CHAPTER = /(?<![\w/.-])docs\/(?<chapter>\d{2}-[a-z\d-]+\.md)/gu;

const SKILL_PAGE = /^(?<root>(?:.*\/)?)skills\/[^/]+\/.+\.md$/u;

const LINK = /!?\[[^\]]*\]\((?<target>[^)\s]+)\)/gu;

// The opening segments are closed on purpose, or every `a/b` in a sentence would read as a
// coordinate; `docs/` and `src/` are absent because a page teaching a convention names the reader's tree.
const BACKTICK_PATH =
    /`(?<path>(?:apps|bin|lib|lint|packages|presets|specs|tests)\/[a-zA-Z\d._/-]+)`/gu;

const withoutFences = (markdown) => markdown.replaceAll(/^```.*?^```/gmsu, '');

const FRONTMATTER = /^---\n.*?\n---\n/su;
const FENCE = /^\s*(?:```|~~~)/u;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/u;
const TABLE_ROW = /^\s*\|/u;
const HEADING = /^(?<hashes>#{1,6})\s/u;

function linesWithFrontmatterBlanked(markdown) {
    return markdown.replace(FRONTMATTER, (block) => block.replaceAll(/[^\n]/gu, '')).split('\n');
}

function longProseBlocks(markdown) {
    let inFence = false;
    let length = 0;
    let start = 0;
    const found = [];
    const close = () => {
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

function airlessFences(markdown) {
    let inFence = false;
    let fenceStart = 0;
    let run = 0;
    const found = [];
    const close = () => {
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

function flatSections(markdown) {
    let inFence = false;
    let title = '';
    let start = 0;
    let prose = 0;
    let broken = false;
    const found = [];
    const close = () => {
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

function isRelative(target) {
    return (
        target !== '' &&
        !target.startsWith('http') &&
        !target.startsWith('#') &&
        !target.startsWith('mailto:') &&
        !target.startsWith('<')
    );
}

// A build product or a workbench clone is absent from a fresh checkout by design; the page naming it is true.
function isIgnored(root, target) {
    // `dist/` in .gitignore matches the directory form only, and `-q` takes one path per probe.
    return [target, `${target}/`].some(
        (spelling) =>
            spawnSync('git', ['check-ignore', '-q', '--no-index', spelling], {
                cwd: root,
                stdio: 'ignore',
            }).status === 0,
    );
}

function missingLinks(root, path, cited) {
    const found = [];
    for (const match of cited.matchAll(LINK)) {
        const { target } = match.groups;
        const clean = target.split('#')[0] ?? '';
        if (!isRelative(target) || clean === '') {
            continue;
        }
        const linked = resolve(root, dirname(path), clean);
        if (!existsSync(linked) && !isIgnored(root, relative(root, linked))) {
            found.push({
                message: `${target} resolves to nothing on disk`,
                rule: 'markdown/link-resolves',
            });
        }
    }

    return found;
}

function missingPaths(root, path, cited) {
    const found = [];
    for (const match of cited.matchAll(BACKTICK_PATH)) {
        const target = match.groups.path.replace(/\/$/u, '');
        if (
            !existsSync(join(root, target)) &&
            !existsSync(resolve(root, dirname(path), target)) &&
            !isIgnored(root, target)
        ) {
            found.push({
                message: `\`${target}\` names nothing on disk`,
                rule: 'markdown/path-resolves',
            });
        }
    }

    return found;
}

function missingChapters(root, path, cited) {
    const skill = SKILL_PAGE.exec(path);
    if (skill === null) {
        return [];
    }

    const found = [];
    for (const match of cited.matchAll(CHAPTER)) {
        const { chapter } = match.groups;
        if (!existsSync(join(root, skill.groups.root, 'docs', chapter))) {
            found.push({
                message: `docs/${chapter} is no chapter this package ships`,
                rule: 'markdown/chapter-reference-resolves',
            });
        }
    }

    return found;
}

function auditPage(root, path, markdown) {
    const cited = withoutFences(markdown);
    const found = [
        ...missingLinks(root, path, cited),
        ...missingPaths(root, path, cited),
        ...missingChapters(root, path, cited),
    ];

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

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const pages = orRefused(() =>
    projectFiles(root, { ignorePatterns: ignorePatternsOf(argv) }),
).filter((path) => path.endsWith('.md'));

let failed = false;
for (const path of pages) {
    const markdown = readText(root, path);
    if (markdown === null) {
        continue;
    }
    for (const violation of auditPage(root, path, markdown)) {
        stdout.write(`${violation.rule}  ${path}  ${violation.message}\n`);
        failed = true;
    }
}

exit(failed ? 1 : 0);
