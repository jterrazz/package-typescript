import type { DocsTree } from '../../kit/project/docs-tree.js';
import type { Report } from './docs.decisions.js';

/** A page of one of the four sections, by its path under `docs/`: `guides/develop.md`. */
export type Page = { name: string; path: string; section: string };

export const SECTIONS: readonly string[] = ['start/', 'guides/', 'concepts/', 'reference/'];

const RELEASE = 'guides/release.md';

// invariant: the release guide is required only by the presence test.
const REQUIRED_PAGES = ['concepts/architecture.md', 'guides/develop.md', 'guides/test.md'];

// invariant: a page names a subject, never the state of a piece of work.
const JOURNAL_WORDS: ReadonlySet<string> = new Set([
    'draft',
    'exploration',
    'legacy',
    'misc',
    'notes',
    'old',
    'proposal',
    'review',
    'todo',
    'wip',
]);

const PAGE_NAME = /^(?!\d+-)[a-z\d]+(?:-[a-z\d]+)*\.md$/u;

const SHIPPING_REASONS: readonly (readonly [keyof DocsTree['ships'], string])[] = [
    ['dockerfile', 'an image (a Dockerfile)'],
    ['infrastructure', 'a deployment (.infrastructure/)'],
    ['publishable', 'a published package (it declares a library or a cli)'],
];

// Stryker disable next-line StringLiteral: the flag only selects unicode mode, which this pattern reads the same
const IN_SECTION = new RegExp(`^docs/(${SECTIONS.join('|')}).`, 'u');

/** Every entry under the four sections, a nested folder and what it holds included. */
export function pagesOf(files: readonly string[]): Page[] {
    return files.flatMap((path) => {
        const section = IN_SECTION.exec(path)?.[1];

        return section === undefined
            ? []
            : [{ name: path.slice(`docs/${section}`.length), path, section }];
    });
}

function auditRelease(
    report: Report,
    { pages, ships }: { pages: readonly Page[]; ships: DocsTree['ships'] },
): void {
    const reason = SHIPPING_REASONS.find(([fact]) => ships[fact])?.[1];
    if (reason !== undefined && !pages.some((page) => page.path === `docs/${RELEASE}`)) {
        report(
            'docs/release-guide-present-when-shipping',
            `docs/${RELEASE}`,
            `${RELEASE} is missing, and this repository ships ${reason}`,
        );
    }
}

export function auditPages(
    report: Report,
    { pages, ships }: { pages: readonly Page[]; ships: DocsTree['ships'] },
): void {
    // invariant: what sits below a nested folder is the folder's; only the folder itself is named.
    for (const page of pages.filter((entry) => /^[^/]+\/$/u.test(entry.name))) {
        report(
            'docs/section-is-flat',
            page.path,
            `${page.path} is a folder inside ${page.section}: a section holds pages, and a sub-folder is a section hiding inside another`,
        );
    }

    const flat = pages.filter((page) => !page.name.includes('/'));

    for (const page of flat) {
        if (!PAGE_NAME.test(page.name)) {
            report(
                'docs/page-named-in-kebab-case',
                page.path,
                `${page.path} is not kebab-case.md (lowercase words, single hyphens, no number, since the map gives the order)`,
            );
        }
    }

    for (const required of REQUIRED_PAGES) {
        if (!pages.some((page) => page.path === `docs/${required}`)) {
            report(
                'docs/required-pages-present',
                `docs/${required}`,
                `${required} is missing: every manual holds concepts/architecture.md, guides/develop.md and guides/test.md`,
            );
        }
    }

    auditRelease(report, { pages, ships });
    auditPageWords(report, flat);
}

function auditPageWords(report: Report, pages: readonly Page[]): void {
    for (const page of pages) {
        const word = page.name.split(/[.-]/u).find((segment) => JOURNAL_WORDS.has(segment));
        if (word !== undefined) {
            report(
                'docs/page-names-a-subject',
                page.path,
                `${page.path} names a journal, not a subject (${word}); the record is an ADR, the history is git's`,
            );
        }
    }
}
