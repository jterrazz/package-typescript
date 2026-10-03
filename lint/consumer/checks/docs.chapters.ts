import type { DocsTree } from '../../kit/project/docs-tree.js';
import type { Report } from './docs.decisions.js';

export type Chapter = { name: string; number: number; path: string };

const SPINE = ['01-architecture.md', '02-developing.md', '03-testing.md', '04-operating.md'];

// invariant: 04 is required only by the presence test.
const REQUIRED_SPINE = SPINE.slice(0, 3);

// invariant: a chapter names a subject, never the state of a piece of work.
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

const CHAPTER_NAME = /^\d{2}-[a-z\d]+(?:-[a-z\d]+)*\.md$/u;

const SHIPPING_REASONS: readonly (readonly [keyof DocsTree['ships'], string])[] = [
    ['dockerfile', 'an image (a Dockerfile)'],
    ['infrastructure', 'a deployment (.infrastructure/)'],
    ['publishable', 'a published package (it declares a library or a cli)'],
];

function twoDigit(value: number): string {
    return String(value).padStart(2, '0');
}

function auditOperating(
    report: Report,
    { chapters, ships }: { chapters: readonly Chapter[]; ships: DocsTree['ships'] | undefined },
): void {
    const operating = SPINE[3];
    const reason = SHIPPING_REASONS.find(([fact]) => ships?.[fact] === true)?.[1];
    if (reason !== undefined && !chapters.some((chapter) => chapter.name === operating)) {
        report(
            'docs/operating-chapter-present-when-shipping',
            `docs/${operating ?? ''}`,
            `${operating ?? ''} is missing — this repository ships ${reason}`,
        );
    }
}

export function auditChapters(
    report: Report,
    { chapters, ships }: { chapters: readonly Chapter[]; ships: DocsTree['ships'] | undefined },
): void {
    for (const chapter of chapters) {
        if (!CHAPTER_NAME.test(chapter.name)) {
            report(
                'docs/chapter-named-by-number-and-subject',
                chapter.path,
                `${chapter.path} is not NN-kebab.md — two digits, lowercase words, single hyphens`,
            );
        }
    }

    auditChapterNumbering(report, chapters);

    for (const chapter of chapters) {
        const reserved = SPINE[chapter.number - 1];
        if (reserved !== undefined && chapter.name !== reserved) {
            report(
                'docs/spine-number-reserved',
                chapter.path,
                `${chapter.path} takes number ${twoDigit(chapter.number)}, which is reserved for ${reserved}`,
            );
        }
    }

    for (const name of REQUIRED_SPINE) {
        if (!chapters.some((chapter) => chapter.name === name)) {
            report(
                'docs/spine-chapters-present',
                `docs/${name}`,
                `${name} is missing — the spine is architecture, developing, testing`,
            );
        }
    }

    auditOperating(report, { chapters, ships });
    auditChapterWords(report, chapters);
}

function auditChapterNumbering(report: Report, chapters: readonly Chapter[]): void {
    const numbers = chapters.map((chapter) => chapter.number).toSorted((a, b) => a - b);
    const hasOperating = numbers.includes(4);
    // invariant: 04 is never required by the spine, so a run missing it is contiguous with every later number shifted down.
    const expected = (index: number): number =>
        !hasOperating && index + 1 >= 4 ? index + 2 : index + 1;
    const contiguous = numbers.every((number, index) => number === expected(index));
    if (numbers.length === 0 || contiguous) {
        return;
    }

    report(
        'docs/chapters-numbered-contiguously',
        'docs/',
        `chapter numbers run ${numbers.map((number) => twoDigit(number)).join(', ')}: they are contiguous from 01, one file per number, except that 04 may be absent`,
    );
}

function auditChapterWords(report: Report, chapters: readonly Chapter[]): void {
    for (const chapter of chapters) {
        const word = chapter.name.split(/[.-]/u).find((segment) => JOURNAL_WORDS.has(segment));
        if (word !== undefined) {
            report(
                'docs/chapter-names-a-subject',
                chapter.path,
                `${chapter.path} names a journal, not a subject — ${word}; the record is an ADR, the history is git's`,
            );
        }
    }
}
