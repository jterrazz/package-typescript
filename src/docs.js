/**
 * The shape of a repository's `docs/`, judged as a pure function.
 *
 * Every repository carries the same manual: a map at `docs/README.md`, a fixed
 * spine — architecture, developing, testing, and operating when the repository
 * ships something that runs — and its own chapters numbered contiguously after
 * it. `auditDocs` takes a plain description of that tree and returns what
 * breaks the shape. Nothing here reads the filesystem, so the same rules judge
 * a project running `typescript check` and a clone nobody installed anything
 * into.
 *
 * This module is the single executable copy of the rule ids AND of the sentence
 * each one prints. A page names the ids and what each refuses; it never spells
 * a message, so the two cannot drift.
 */

/** How many opening lines of a file a rule may read — the reader supplies them. */
export const HEAD_LINES = 20;

/** The four reserved numbers, in order: position 01 through 04. */
const SPINE = ['01-architecture.md', '02-developing.md', '03-testing.md', '04-operating.md'];

/** The three the spine REQUIRES; 04 is required only by the presence test. */
const REQUIRED_SPINE = SPINE.slice(0, 3);

/** The only subfolders `docs/` may hold. */
const SUBFOLDERS = new Set(['_assets/', 'decisions/', 'reference/']);

/**
 * The closed roster of journal words. A chapter names a SUBJECT the repository
 * has, never the state of a piece of work: the record of a decision is an ADR,
 * and the history is git's. This is the roster's one copy — no page keeps a
 * second one.
 */
const JOURNAL_WORDS = new Set([
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

/** The closed status vocabulary of a decision record. */
const STATUSES = new Set(['Proposed', 'Accepted', 'Deprecated']);

/**
 * The fourth status carries the record that replaced it, as a link a reader
 * can follow — a citation is a place a human can look, not just a number.
 */
const SUPERSEDED = /^Superseded by \[ADR-\d{3}\]\([^)]+\)$/;

/** The same status named but not linked — the successor exists, the citation does not. */
const BARE_SUPERSEDED = /^Superseded by ADR-\d{3}$/;

/** What a chapter's file name must be: two digits, lowercase words, single hyphens. */
const CHAPTER_NAME = /^\d{2}-[a-z\d]+(?:-[a-z\d]+)*\.md$/;

/** What a decision record's file name must be: three digits, then the same words. */
const DECISION_NAME = /^\d{3}-[a-z\d]+(?:-[a-z\d]+)*\.md$/;

/** A decision record's first heading, carrying the number the file claims. */
const DECISION_HEADING = /^# ADR-(?<number>\d{3}): \S/;

/** The `**Status:**` line of a decision record, wherever it sits in the head. */
const DECISION_STATUS = /^\*\*Status:\*\*\s*(?<status>.+?)\s*$/;

/** The marker every file under `reference/` carries — it is generated, never authored. */
const GENERATED = 'GENERATED';

/** A link with a scheme (`https:`, `mailto:`) cites; it never reaches into a tree. */
const SCHEME = /^[a-z][\d+.a-z-]*:/i;

/** What each of the three presence facts means, in the sentence `04` is asked for. */
const SHIPPING_REASONS = [
    ['dockerfile', 'an image (a Dockerfile)'],
    ['infrastructure', 'a deployment (.infrastructure/)'],
    ['publishable', 'a published package (package.json is not private)'],
];

/** Directly under `docs/` — a file, or a directory with its trailing slash. */
function directChildren(files) {
    return files.filter((path) => /^docs\/[^/]+\/?$/.test(path));
}

/** Everything under a folder of `docs/`, named relative to that folder. */
function under(files, folder) {
    const prefix = `docs/${folder}`;

    return files
        .filter((path) => path.startsWith(prefix) && !path.endsWith('/'))
        .map((path) => ({ name: path.slice(prefix.length), path }));
}

/** A number as a chapter writes it — two digits, more only when it has to. */
function padded(value) {
    return String(value).padStart(2, '0');
}

/** The link target itself, without the anchor a reader lands on. */
function targetPath(link) {
    return link.split('#')[0].replace(/^\.\//, '');
}

/** A link that names a chapter of the same folder — `03-testing.md`, no slash. */
function isChapterLink(target) {
    return /^\d/.test(target) && !target.includes('/');
}

/**
 * A link resolved against the page carrying it, `..` folded. A result that
 * still opens on `..` climbed above the repository root: it reaches into
 * another tree.
 */
function resolveLink(from, link) {
    const stack = [];

    for (const segment of [...from.split('/').slice(0, -1), ...link.split('/')]) {
        if (segment === '' || segment === '.') {
            continue;
        }
        if (segment !== '..') {
            stack.push(segment);
        } else if (stack.length === 0 || stack.at(-1) === '..') {
            stack.push('..');
        } else {
            stack.pop();
        }
    }

    return stack.join('/');
}

/** The map's verdicts: it exists, it is bijective with the chapters, it routes nowhere else. */
function auditMap(report, { chapters, files, links }) {
    if (!files.includes('docs/README.md')) {
        report(
            'docs-map-missing',
            'docs/README.md',
            'docs/README.md is missing — the map is the one file an outside corpus points at',
        );

        return;
    }

    const rows = [...new Set(links.map((link) => targetPath(link)).filter(isChapterLink))];

    for (const row of rows) {
        if (!chapters.some((chapter) => chapter.name === row)) {
            report(
                'docs-map-drift',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${row} has no file`,
            );
        }
    }
    for (const chapter of chapters) {
        if (!rows.includes(chapter.name)) {
            report(
                'docs-map-drift',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${chapter.name} has no row`,
            );
        }
    }

    for (const link of links) {
        const target = targetPath(link);
        const routes =
            target === '' ||
            isChapterLink(target) ||
            target.startsWith('decisions/') ||
            target.startsWith('reference/');

        if (!routes) {
            report(
                'docs-map-foreign-link',
                'docs/README.md',
                `docs/README.md links ${link}: the map routes to its own chapters and nothing else`,
            );
        }
    }
}

/** The chapters: their names, their numbering, the four reserved positions, their subjects. */
function auditChapters(report, { chapters, ships }) {
    for (const chapter of chapters) {
        if (!CHAPTER_NAME.test(chapter.name)) {
            report(
                'docs-chapter-name',
                chapter.path,
                `${chapter.path} is not NN-kebab.md — two digits, lowercase words, single hyphens`,
            );
        }
    }

    const numbers = chapters.map((chapter) => chapter.number).sort((a, b) => a - b);
    const hasOperating = numbers.includes(4);
    // 04 is the one number the spine never requires (`docs-operating-missing`
    // Asks for it on its own terms), so a run missing it is still contiguous —
    // Every number from 05 on shifts down one slot to close the gap.
    const expected = (index) => (!hasOperating && index + 1 >= 4 ? index + 2 : index + 1);
    const contiguous = numbers.every((number, index) => number === expected(index));
    if (numbers.length > 0 && !contiguous) {
        report(
            'docs-chapter-numbering',
            'docs/',
            `chapter numbers run ${numbers.map(padded).join(', ')}: they are contiguous from 01, one file per number, except that 04 may be absent`,
        );
    }

    for (const chapter of chapters) {
        const reserved = SPINE[chapter.number - 1];
        if (reserved !== undefined && chapter.name !== reserved) {
            report(
                'docs-spine-name',
                chapter.path,
                `${chapter.path} takes number ${padded(chapter.number)}, which is reserved for ${reserved}`,
            );
        }
    }

    for (const name of REQUIRED_SPINE) {
        if (!chapters.some((chapter) => chapter.name === name)) {
            report(
                'docs-spine-missing',
                `docs/${name}`,
                `${name} is missing — the spine is architecture, developing, testing`,
            );
        }
    }

    const operating = SPINE[3];
    const reason = SHIPPING_REASONS.find(([fact]) => ships?.[fact])?.[1];
    if (reason !== undefined && !chapters.some((chapter) => chapter.name === operating)) {
        report(
            'docs-operating-missing',
            `docs/${operating}`,
            `${operating} is missing — this repository ships ${reason}`,
        );
    }

    for (const chapter of chapters) {
        const word = chapter.name.split(/[.-]/).find((segment) => JOURNAL_WORDS.has(segment));
        if (word !== undefined) {
            report(
                'docs-journal-chapter',
                chapter.path,
                `${chapter.path} names a journal, not a subject — ${word}; the record is an ADR, the history is git's`,
            );
        }
    }
}

/** What sits directly under `docs/` and is neither the map, a chapter, nor one of the three folders. */
function auditFolder(report, { children }) {
    for (const path of children) {
        const name = path.slice('docs/'.length);

        if (name.endsWith('/')) {
            if (!SUBFOLDERS.has(name)) {
                report(
                    'docs-foreign-folder',
                    path,
                    `${path} is not one of decisions/, reference/, _assets/`,
                );
            }
        } else if (name !== 'README.md' && !/^\d/.test(name)) {
            report(
                'docs-loose-file',
                path,
                `${path} is neither the map nor a chapter — number it, or move it under _assets/`,
            );
        }
    }
}

/** One decision record: the name it takes, the heading it opens on, the status it declares. */
function auditRecord(report, record, heads) {
    const number = record.name.slice(0, 3);
    const head = heads[record.path] ?? [];
    const opening = head[0] ?? '';

    if (DECISION_HEADING.exec(opening)?.groups?.number !== number) {
        report(
            'docs-decision-heading',
            record.path,
            `${record.path} opens on ${opening === '' ? 'an empty line' : opening}: the mold is "# ADR-${number}: Title"`,
        );
    }

    const status = head.map((line) => DECISION_STATUS.exec(line)?.groups?.status).find(Boolean);
    if (status === undefined || !(STATUSES.has(status) || SUPERSEDED.test(status))) {
        const message =
            status !== undefined && BARE_SUPERSEDED.test(status)
                ? `${record.path}: **Status:** names a successor but no link — write Superseded by [ADR-NNN](file.md)`
                : `${record.path}: **Status:** is none of Proposed, Accepted, Superseded by [ADR-NNN](file.md), Deprecated`;
        report('docs-decision-status', record.path, message);
    }
}

/** The `decisions/` folder: its records, its numbering, its mold, and the index it never keeps. */
function auditDecisions(report, { files, heads }) {
    if (!files.includes('docs/decisions/')) {
        return;
    }

    const entries = under(files, 'decisions/');

    for (const entry of entries) {
        if (entry.name !== '_template.md' && entry.name !== 'README.md') {
            if (!DECISION_NAME.test(entry.name)) {
                report('docs-decision-name', entry.path, `${entry.path} is not NNN-kebab.md`);
            }
        }
    }

    const records = entries.filter((entry) => /^\d{3}-/.test(entry.name));
    for (const record of records) {
        auditRecord(report, record, heads);
    }

    const claimed = new Map();
    for (const record of records) {
        const number = record.name.slice(0, 3);
        const first = claimed.get(number);

        if (first === undefined) {
            claimed.set(number, record.name);
        } else {
            report(
                'docs-decision-number',
                'docs/decisions/',
                `ADR-${number} is claimed by ${first} and ${record.name}`,
            );
        }
    }

    if (files.includes('docs/decisions/README.md')) {
        report(
            'docs-decision-index',
            'docs/decisions/README.md',
            'docs/decisions/README.md is an index — an index is a copy; the queue is derived (terra <brand> decisions)',
        );
    }

    if (!files.includes('docs/decisions/_template.md')) {
        report(
            'docs-template-missing',
            'docs/decisions/_template.md',
            'docs/decisions/_template.md is missing — the mold sits where the record is written',
        );
    }
}

/** Every page under `reference/` says so on its first line: it is a projection. */
function auditReference(report, { files, heads }) {
    for (const entry of under(files, 'reference/')) {
        if (!entry.name.endsWith('.md')) {
            continue;
        }
        if (!(heads[entry.path]?.[0] ?? '').includes(GENERATED)) {
            report(
                'docs-reference-unstamped',
                entry.path,
                `${entry.path} carries no ${GENERATED} marker — reference/ is a projection, never authored`,
            );
        }
    }
}

/** No page of the manual reaches into a tree the repository does not own. */
function auditLinks(report, { files, links }) {
    for (const path of files) {
        for (const link of links[path] ?? []) {
            if (link.startsWith('#') || SCHEME.test(link)) {
                continue;
            }
            if (link.startsWith('/') || resolveLink(path, link).startsWith('..')) {
                report(
                    'docs-cross-repo-link',
                    path,
                    `${path} links ${link}: another repository's tree is not a place this manual may reach`,
                );
            }
        }
    }
}

/**
 * What breaks the shape of `docs/`, in rule order, each violation naming the
 * path it is about. An empty array is a compliant manual.
 *
 * A repository with no `docs/` gets exactly one violation: every other rule
 * would restate the same absence, and one sentence is the whole answer.
 */
export function auditDocs(tree) {
    const files = tree.files ?? [];

    if (!files.includes('docs/')) {
        return [
            {
                message:
                    'docs/ is missing — every repository carries its own manual, starting at docs/README.md',
                path: 'docs/',
                rule: 'docs-absent',
            },
        ];
    }

    const violations = [];
    const report = (rule, path, message) => violations.push({ message, path, rule });

    const children = directChildren(files);
    const chapters = children
        .filter((path) => !path.endsWith('/') && /^\d/.test(path.slice('docs/'.length)))
        .map((path) => ({
            name: path.slice('docs/'.length),
            number: Number.parseInt(path.slice('docs/'.length), 10),
            path,
        }));
    const heads = tree.heads ?? {};
    const links = tree.links ?? {};

    auditMap(report, { chapters, files, links: links['docs/README.md'] ?? [] });
    auditChapters(report, { chapters, ships: tree.ships });
    auditFolder(report, { children });
    auditDecisions(report, { files, heads });
    auditReference(report, { files, heads });

    if (tree.agents === null || !(tree.agents ?? '').includes('docs/README.md')) {
        report(
            'docs-agents-route',
            'AGENTS.md',
            'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
        );
    }

    auditLinks(report, { files, links });

    return violations;
}
