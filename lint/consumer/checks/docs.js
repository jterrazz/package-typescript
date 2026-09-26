// The single executable copy of the rule ids and of each sentence they print; pages name ids, never
// messages. Nothing here reads the filesystem, so a clone nobody installed into is judged the same.
export const HEAD_LINES = 20;

const SPINE = ['01-architecture.md', '02-developing.md', '03-testing.md', '04-operating.md'];

// 04 is required only by the presence test.
const REQUIRED_SPINE = SPINE.slice(0, 3);

const SUBFOLDERS = new Set(['_assets/', 'decisions/']);

// A generated API reference is a second copy of the types an editor resolves: refused by name.
const GENERATED_REFERENCE = 'reference/';

// A chapter names a subject, never the state of a piece of work.
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

const STATUSES = new Set(['Proposed', 'Accepted', 'Deprecated']);

const SUPERSEDED = /^Superseded by \[ADR-\d{3}\]\([^)]+\)$/u;

const BARE_SUPERSEDED = /^Superseded by ADR-\d{3}$/u;

const CHAPTER_NAME = /^\d{2}-[a-z\d]+(?:-[a-z\d]+)*\.md$/u;

const DECISION_NAME = /^\d{3}-[a-z\d]+(?:-[a-z\d]+)*\.md$/u;

const DECISION_HEADING = /^# ADR-(?<number>\d{3}): \S/u;

const DECISION_STATUS = /^\*\*Status:\*\*\s*(?<status>.+?)\s*$/u;

const SCHEME = /^[a-z][\d+.a-z-]*:/iu;

const SHIPPING_REASONS = [
    ['dockerfile', 'an image (a Dockerfile)'],
    ['infrastructure', 'a deployment (.infrastructure/)'],
    ['publishable', 'a published package (package.json is not private)'],
];

function directChildren(files) {
    return files.filter((path) => /^docs\/[^/]+\/?$/u.test(path));
}

function filesUnder(files, folder) {
    const prefix = `docs/${folder}`;

    return files
        .filter((path) => path.startsWith(prefix) && !path.endsWith('/'))
        .map((path) => ({ name: path.slice(prefix.length), path }));
}

function twoDigit(value) {
    return String(value).padStart(2, '0');
}

function targetPath(link) {
    return link.split('#')[0].replace(/^\.\//u, '');
}

function isChapterLink(target) {
    return /^\d/u.test(target) && !target.includes('/');
}

// A result still opening on `..` climbed above the repository root.
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

function auditMap(report, { chapters, files, links }) {
    if (!files.includes('docs/README.md')) {
        report(
            'docs/map-present',
            'docs/README.md',
            'docs/README.md is missing — the map is the one file an outside corpus points at',
        );

        return;
    }

    const rows = [...new Set(links.map((link) => targetPath(link)).filter(isChapterLink))];

    for (const row of rows) {
        if (!chapters.some((chapter) => chapter.name === row)) {
            report(
                'docs/map-matches-chapters',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${row} has no file`,
            );
        }
    }
    for (const chapter of chapters) {
        if (!rows.includes(chapter.name)) {
            report(
                'docs/map-matches-chapters',
                'docs/README.md',
                `docs/README.md and the chapters disagree: ${chapter.name} has no row`,
            );
        }
    }

    for (const link of links) {
        const target = targetPath(link);
        const routes = target === '' || isChapterLink(target) || target.startsWith('decisions/');

        if (!routes) {
            report(
                'docs/map-links-only-chapters',
                'docs/README.md',
                `docs/README.md links ${link}: the map routes to its own chapters and nothing else`,
            );
        }
    }
}

function auditChapters(report, { chapters, ships }) {
    for (const chapter of chapters) {
        if (!CHAPTER_NAME.test(chapter.name)) {
            report(
                'docs/chapter-named-nn-kebab',
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

    const operating = SPINE[3];
    const reason = SHIPPING_REASONS.find(([fact]) => ships?.[fact])?.[1];
    if (reason !== undefined && !chapters.some((chapter) => chapter.name === operating)) {
        report(
            'docs/operating-chapter-present-when-shipping',
            `docs/${operating}`,
            `${operating} is missing — this repository ships ${reason}`,
        );
    }

    auditChapterWords(report, chapters);
}

function auditChapterNumbering(report, chapters) {
    const numbers = chapters.map((chapter) => chapter.number).toSorted((a, b) => a - b);
    const hasOperating = numbers.includes(4);
    // 04 is never required by the spine, so a run missing it is contiguous with every later number shifted down.
    const expected = (index) => (!hasOperating && index + 1 >= 4 ? index + 2 : index + 1);
    const contiguous = numbers.every((number, index) => number === expected(index));
    if (numbers.length === 0 || contiguous) {
        return;
    }

    report(
        'docs/chapters-numbered-contiguously',
        'docs/',
        `chapter numbers run ${numbers.map(twoDigit).join(', ')}: they are contiguous from 01, one file per number, except that 04 may be absent`,
    );
}

function auditChapterWords(report, chapters) {
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

function auditDecisionNumbers(report, records) {
    const numbers = [...new Set(records.map((record) => record.name.slice(0, 3)))].toSorted(
        (left, right) => left.localeCompare(right),
    );
    const sequential = numbers.every((number, index) => Number.parseInt(number, 10) === index + 1);
    if (numbers.length > 0 && !sequential) {
        report(
            'docs/decisions-numbered-contiguously',
            'docs/decisions/',
            `docs/decisions/ numbers run ${numbers.join(', ')}: they run from 001 with no gap — a decision that moved folders takes the next number where it lands`,
        );
    }

    const claimed = new Map();
    for (const record of records) {
        const number = record.name.slice(0, 3);
        const first = claimed.get(number);

        if (first === undefined) {
            claimed.set(number, record.name);
        } else {
            report(
                'docs/decision-number-unique',
                'docs/decisions/',
                `ADR-${number} is claimed by ${first} and ${record.name}`,
            );
        }
    }
}

function auditFolder(report, { children }) {
    for (const path of children) {
        const name = path.slice('docs/'.length);

        if (name === GENERATED_REFERENCE) {
            report(
                'docs/no-generated-reference',
                path,
                `${path} is a generated API reference — the API is the types, and the manual holds no copy of them`,
            );
        } else if (name.endsWith('/')) {
            if (!SUBFOLDERS.has(name)) {
                report(
                    'docs/no-unknown-subfolder',
                    path,
                    `${path} is not one of decisions/, _assets/`,
                );
            }
        } else if (name !== 'README.md' && !/^\d/u.test(name)) {
            report(
                'docs/no-loose-file',
                path,
                `${path} is neither the map nor a chapter — number it, or move it under _assets/`,
            );
        }
    }
}

function auditRecord(report, record, heads) {
    const number = record.name.slice(0, 3);
    const head = heads[record.path] ?? [];
    const opening = head[0] ?? '';

    if (DECISION_HEADING.exec(opening)?.groups?.number !== number) {
        report(
            'docs/decision-heading-carries-its-number',
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
        report('docs/decision-status-known', record.path, message);
    }
}

function auditDecisions(report, { files, heads }) {
    if (!files.includes('docs/decisions/')) {
        return;
    }

    const entries = filesUnder(files, 'decisions/');

    for (const entry of entries) {
        const mold = entry.name === '_template.md' || entry.name === 'README.md';
        if (!mold && !DECISION_NAME.test(entry.name)) {
            report(
                'docs/decision-named-nnn-kebab',
                entry.path,
                `${entry.path} is not NNN-kebab.md`,
            );
        }
    }

    const records = entries.filter((entry) => /^\d{3}-/u.test(entry.name));
    for (const record of records) {
        auditRecord(report, record, heads);
    }

    auditDecisionNumbers(report, records);

    if (files.includes('docs/decisions/README.md')) {
        report(
            'docs/decision-listed-in-the-map',
            'docs/decisions/README.md',
            'docs/decisions/README.md is an index — an index is a copy; the queue is derived (terra <brand> decisions)',
        );
    }

    if (!files.includes('docs/decisions/_template.md')) {
        report(
            'docs/decision-template-present',
            'docs/decisions/_template.md',
            'docs/decisions/_template.md is missing — the mold sits where the record is written',
        );
    }
}

function auditLinks(report, { files, links }) {
    for (const path of files) {
        for (const link of links[path] ?? []) {
            if (link.startsWith('#') || SCHEME.test(link)) {
                continue;
            }
            if (link.startsWith('/') || resolveLink(path, link).startsWith('..')) {
                report(
                    'docs/no-cross-repository-link',
                    path,
                    `${path} links ${link}: another repository's tree is not a place this manual may reach`,
                );
            }
        }
    }
}

// A repository with no `docs/` gets exactly one violation: every other rule would restate the absence.
export function auditDocs(tree) {
    const files = tree.files ?? [];

    if (!files.includes('docs/')) {
        return [
            {
                message:
                    'docs/ is missing — every repository carries its own manual, starting at docs/README.md',
                path: 'docs/',
                rule: 'docs/manual-present',
            },
        ];
    }

    const violations = [];
    const report = (rule, path, message) => violations.push({ message, path, rule });

    const children = directChildren(files);
    const chapters = children
        .filter((path) => !path.endsWith('/') && /^\d/u.test(path.slice('docs/'.length)))
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

    if (tree.agents === null || !(tree.agents ?? '').includes('docs/README.md')) {
        report(
            'docs/agents-route-to-the-map',
            'AGENTS.md',
            'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
        );
    }

    auditLinks(report, { files, links });

    return violations;
}
