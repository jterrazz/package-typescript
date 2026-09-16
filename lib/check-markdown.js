#!/usr/bin/env node

/**
 * A repository's prose, held to what a page owes its reader: its coordinates
 * resolve, and its blocks breathe.
 *
 * Two families. **Coordinates** — every relative link and every backticked
 * repo-relative path names something on disk, because a page that cites a file
 * it cannot reach has already drifted from the tree it describes. **Floors** —
 * the mechanical half of "How a page reads": a paragraph that runs past twelve
 * lines, a fenced block that runs fifteen without breathing, a `##` section of
 * thirty lines of prose broken by neither a `###` nor a list. The three numbers
 * are a floor, not the craft the doctrine asks for; the gap between them is a
 * reader's pass, not a red gate.
 *
 * Usage: node check-markdown.js [root] [--ignore-pattern <glob>]…
 *
 * One line per violation, `<rule>  <path>  <message>`. Exit code: 0 when the
 * prose holds, 1 otherwise. No `--fix`: there is no rewrite that can split a
 * paragraph into the two ideas it was carrying.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, readText, trackedFiles } from './tracked-files.js';

/** A paragraph, or one list item with its continuations, past this is a wall. */
const PROSE_BLOCK_LIMIT = 12;

/** A fenced block is measured by its longest run with no blank line in it. */
const FENCE_RUN_LIMIT = 15;

/** A `##` section carrying neither a `###` nor a list may run this long. */
const SECTION_PROSE_LIMIT = 30;

/** A generated projection is a machine's output, and its shape is its compiler's. */
const GENERATED = 'docs/reference/';

const LINK = /!?\[[^\]]*\]\((?<target>[^)\s]+)\)/gu;

/**
 * A backticked string that reads as a path into this repository. The roster of
 * opening segments is closed on purpose: without it every `a/b` in a sentence
 * — a URL fragment, a ratio, a unit — would be read as a coordinate.
 *
 * `docs/` and `src/` are deliberately absent, and for one reason: every
 * repository has both, so a page teaching a convention writes `src/index.ts`
 * or `docs/03-testing.md` about the READER's tree, not about its own. A
 * relative link into either is still judged — that one names a real target.
 */
const BACKTICK_PATH = /`(?<path>(?:apps|bin|lib|packages|presets|specs|tests)\/[a-zA-Z\d._/-]+)`/gu;

/** A fenced example illustrates; it does not cite. */
const withoutFences = (markdown) => markdown.replaceAll(/^```.*?^```/gmsu, '');

/** A harness header at the very top of a file: metadata, and never a paragraph. */
const FRONTMATTER = /^---\n.*?\n---\n/su;
const FENCE = /^\s*(?:```|~~~)/u;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/u;
const TABLE_ROW = /^\s*\|/u;
const HEADING = /^(?<hashes>#{1,6})\s/u;

/** Blanked line for line, so a reported line number still points at the page's. */
function lines(markdown) {
    return markdown.replace(FRONTMATTER, (block) => block.replaceAll(/[^\n]/gu, '')).split('\n');
}

/**
 * A block is the reader's unit, not the parser's: a paragraph, or a single list
 * item with its continuations. A blank line, a heading, a table row, a fence or
 * the next list marker all stop one.
 */
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

    for (const [index, line] of lines(markdown).entries()) {
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

/** A fenced block is measured by its longest unbroken run: grouping is blank lines. */
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

    for (const [index, line] of lines(markdown).entries()) {
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

/** A `##` section of pure prose, carrying neither a `###` nor a list to break it up. */
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

    for (const [index, line] of lines(markdown).entries()) {
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
                /* An h1 titles the page; it is not one of its questions. */
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

/** A link a page owns: not a URL, not an anchor, not a mail address. */
function isRelative(target) {
    return (
        target !== '' &&
        !target.startsWith('http') &&
        !target.startsWith('#') &&
        !target.startsWith('mailto:') &&
        !target.startsWith('<')
    );
}

/*
 * A coordinate git ignores is not stale: a build product, a workbench clone
 * or a generated tree is absent from a fresh checkout by design, and the page
 * that names it is still true. Outside a repository nothing is ignored.
 */
function isIgnored(root, target) {
    const probe = spawnSync('git', ['check-ignore', '-q', '--no-index', target], {
        cwd: root,
        stdio: 'ignore',
    });

    return probe.status === 0;
}

/** The links of one page that resolve to nothing, ignored coordinates forgiven. */
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
                rule: 'markdown-link-missing',
            });
        }
    }

    return found;
}

/** The backticked paths of one page that name nothing, ignored coordinates forgiven. */
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
                rule: 'markdown-path-missing',
            });
        }
    }

    return found;
}

/** Every violation of one page, in the order the rules are declared. */
function auditPage(root, path, markdown) {
    const cited = withoutFences(markdown);
    const found = [...missingLinks(root, path, cited), ...missingPaths(root, path, cited)];

    for (const reason of longProseBlocks(markdown)) {
        found.push({ message: reason, rule: 'markdown-block-long' });
    }
    for (const reason of airlessFences(markdown)) {
        found.push({ message: reason, rule: 'markdown-fence-long' });
    }
    for (const reason of flatSections(markdown)) {
        found.push({ message: reason, rule: 'markdown-section-flat' });
    }

    return found;
}

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const pages = trackedFiles(root, { ignorePatterns: ignorePatternsOf(argv) }).filter(
    (path) =>
        path.endsWith('.md') && !path.startsWith(GENERATED) && !path.includes(`/${GENERATED}`),
);

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
