import { expect, test } from 'vitest';

import { auditDocs } from './docs.js';

/**
 * The manual every repository carries, in its smallest compliant form: a map,
 * the three required spine chapters, and a brief that routes into it. Each test
 * breaks exactly one thing and reads the rule that names it.
 */
function manual(overrides: Record<string, unknown> = {}) {
    return {
        agents: '# Agent brief\n\nThe corpus is docs/README.md.\n',
        files: [
            'docs/',
            'docs/01-architecture.md',
            'docs/02-developing.md',
            'docs/03-testing.md',
            'docs/README.md',
        ],
        heads: {},
        links: {
            'docs/README.md': ['01-architecture.md', '02-developing.md', '03-testing.md'],
        },
        ships: { dockerfile: false, infrastructure: false, publishable: false },
        ...overrides,
    };
}

/** The rule ids a tree breaks, in the order the engine reports them. */
function rules(tree: ReturnType<typeof manual>) {
    return auditDocs(tree as never).map((violation) => violation.rule);
}

/** The sentence one rule printed about a tree. */
function sentence(tree: ReturnType<typeof manual>, rule: string) {
    return auditDocs(tree as never).find((violation) => violation.rule === rule)?.message;
}

test('passes the smallest compliant manual', () => {
    // Given - a map, the three spine chapters, a brief that routes into them
    // Then - nothing to say
    expect(auditDocs(manual() as never)).toEqual([]);
});

test('names a repository that carries no manual at all, and says nothing else', () => {
    // Given - a repository with no docs/ directory
    const tree = manual({ agents: null, files: [] });

    // Then - one sentence, not a cascade of every rule the absence breaks
    expect(rules(tree)).toEqual(['docs-absent']);
    expect(sentence(tree, 'docs-absent')).toBe(
        'docs/ is missing — every repository carries its own manual, starting at docs/README.md',
    );
});

test('names a docs/ with no map', () => {
    // Given - chapters with no README.md to route into them
    const tree = manual({
        files: ['docs/', 'docs/01-architecture.md', 'docs/02-developing.md', 'docs/03-testing.md'],
        links: {},
    });

    // Then - the map is the one file an outside corpus points at
    expect(rules(tree)).toEqual(['docs-map-missing']);
    expect(sentence(tree, 'docs-map-missing')).toBe(
        'docs/README.md is missing — the map is the one file an outside corpus points at',
    );
});

test('names a map that routes to a chapter nobody wrote', () => {
    // Given - a row for a fourth chapter that does not exist
    const tree = manual({
        links: {
            'docs/README.md': [
                '01-architecture.md',
                '02-developing.md',
                '03-testing.md',
                '05-presets.md',
            ],
        },
    });

    // Then - the drift is named from the map's side
    expect(sentence(tree, 'docs-map-drift')).toBe(
        'docs/README.md and the chapters disagree: 05-presets.md has no file',
    );
});

test('names a chapter the map forgot', () => {
    // Given - a fourth chapter with no row
    const tree = manual({
        files: [...manual().files, 'docs/04-operating.md'],
    });

    // Then - the drift is named from the chapter's side
    expect(sentence(tree, 'docs-map-drift')).toBe(
        'docs/README.md and the chapters disagree: 04-operating.md has no row',
    );
});

test('names a map link that leaves the manual', () => {
    // Given - a map routing to the repository's own README
    const tree = manual({
        links: { 'docs/README.md': [...manual().links['docs/README.md'], '../README.md'] },
    });

    // Then - the map routes to chapters, decisions/ and reference/, and nothing else
    expect(sentence(tree, 'docs-map-foreign-link')).toBe(
        'docs/README.md links ../README.md: the map routes to its own chapters and nothing else',
    );
});

test('lets the map route to decisions/ and reference/', () => {
    // Given - the two folders a map may point at
    const tree = manual({
        links: {
            'docs/README.md': [
                ...manual().links['docs/README.md'],
                'decisions/',
                'reference/index.md',
            ],
        },
    });

    // Then - neither is foreign
    expect(rules(tree)).toEqual([]);
});

test('names a chapter that is not NN-kebab.md', () => {
    // Given - a fourth chapter with one digit and an upper-case word
    const tree = manual({
        files: [...manual().files, 'docs/4-Lint_presets.md'],
        links: { 'docs/README.md': [...manual().links['docs/README.md'], '4-Lint_presets.md'] },
    });

    // Then - the mold is named, and the number it took is still judged
    expect(sentence(tree, 'docs-chapter-name')).toBe(
        'docs/4-Lint_presets.md is not NN-kebab.md — two digits, lowercase words, single hyphens',
    );
});

test('names chapter numbers that skip, and numbers claimed twice', () => {
    // Given - two chapters numbered 05 and none numbered 04
    const tree = manual({
        files: [...manual().files, 'docs/05-building.md', 'docs/05-presets.md'],
        links: {
            'docs/README.md': [
                ...manual().links['docs/README.md'],
                '05-building.md',
                '05-presets.md',
            ],
        },
    });

    // Then - one sentence about the whole run
    expect(sentence(tree, 'docs-chapter-numbering')).toBe(
        'chapter numbers run 01, 02, 03, 05, 05: they are contiguous from 01, one file per number, except that 04 may be absent',
    );
});

test('names a chapter sitting on a reserved number', () => {
    // Given - a getting-started chapter taking position 01
    const tree = manual({
        files: ['docs/', 'docs/01-getting-started.md', 'docs/README.md'],
        links: { 'docs/README.md': ['01-getting-started.md'] },
    });

    // Then - the position names its owner
    expect(sentence(tree, 'docs-spine-name')).toBe(
        'docs/01-getting-started.md takes number 01, which is reserved for 01-architecture.md',
    );
});

test('names each missing spine chapter', () => {
    // Given - a manual holding architecture alone
    const tree = manual({
        files: ['docs/', 'docs/01-architecture.md', 'docs/README.md'],
        links: { 'docs/README.md': ['01-architecture.md'] },
    });

    // Then - developing and testing are each asked for
    expect(rules(tree)).toEqual(['docs-spine-missing', 'docs-spine-missing']);
    expect(sentence(tree, 'docs-spine-missing')).toBe(
        '02-developing.md is missing — the spine is architecture, developing, testing',
    );
});

test('asks for 04-operating.md from a repository that ships an image', () => {
    // Given - a Dockerfile at the root or at a workspace member's root
    const tree = manual({ ships: { dockerfile: true, infrastructure: false, publishable: false } });

    // Then - the reason it is asked for is named
    expect(sentence(tree, 'docs-operating-missing')).toBe(
        '04-operating.md is missing — this repository ships an image (a Dockerfile)',
    );
});

test('asks for 04-operating.md from a published package', () => {
    // Given - a manifest that never says it is private
    const tree = manual({ ships: { dockerfile: false, infrastructure: false, publishable: true } });

    // Then - the third clause of the presence test speaks
    expect(sentence(tree, 'docs-operating-missing')).toBe(
        '04-operating.md is missing — this repository ships a published package (package.json is not private)',
    );
});

test('never asks for 04-operating.md from a repository that ships nothing', () => {
    // Given - no image, no infrastructure, a private manifest
    // Then - the lint only ever requires; it never forbids a 04 either
    expect(rules(manual())).toEqual([]);
});

test('lets 05 follow 03 directly when the repository ships nothing', () => {
    // Given - 01-03 then 05, no 04 chapter, nothing that would ask for one
    const tree = manual({
        files: [...manual().files, 'docs/05-building.md'],
        links: { 'docs/README.md': [...manual().links['docs/README.md'], '05-building.md'] },
    });

    // Then - 04 is the one gap the numbering excuses
    expect(rules(tree)).toEqual([]);
});

test('still asks for 04-operating.md from that same shape once it ships', () => {
    // Given - the same 01-03 + 05 shape, but an image this time
    const tree = manual({
        files: [...manual().files, 'docs/05-building.md'],
        links: { 'docs/README.md': [...manual().links['docs/README.md'], '05-building.md'] },
        ships: { dockerfile: true, infrastructure: false, publishable: false },
    });

    // Then - the numbering stays clean; only the presence test speaks
    expect(rules(tree)).toEqual(['docs-operating-missing']);
});

test('refuses a gap at 05 even though 04 may be absent', () => {
    // Given - 01-03 then 06, skipping past the one number the spine excuses
    const tree = manual({
        files: [...manual().files, 'docs/06-quality-checks.md'],
        links: { 'docs/README.md': [...manual().links['docs/README.md'], '06-quality-checks.md'] },
    });

    // Then - only 04 is excused; 05 still has to be there
    expect(rules(tree)).toEqual(['docs-chapter-numbering']);
});

test('names a chapter that is a journal, not a subject', () => {
    // Given - a fourth chapter recording a design exploration
    const tree = manual({
        files: [...manual().files, 'docs/04-design-exploration.md'],
        links: {
            'docs/README.md': [...manual().links['docs/README.md'], '04-design-exploration.md'],
        },
    });

    // Then - the word is named, and so is where that content belongs
    expect(sentence(tree, 'docs-journal-chapter')).toBe(
        "docs/04-design-exploration.md names a journal, not a subject — exploration; the record is an ADR, the history is git's",
    );
});

test('names a subfolder that is none of the three', () => {
    // Given - a folder of dated QA passes under docs/
    const tree = manual({ files: [...manual().files, 'docs/qa/', 'docs/qa/2026-01.md'] });

    // Then - the three are named
    expect(sentence(tree, 'docs-foreign-folder')).toBe(
        'docs/qa/ is not one of decisions/, reference/, _assets/',
    );
});

test('names a file under docs/ that is neither the map nor a chapter', () => {
    // Given - an unnumbered page dropped beside the chapters
    const tree = manual({ files: [...manual().files, 'docs/automations.md'] });

    // Then - number it, or move it out of the chapter space
    expect(sentence(tree, 'docs-loose-file')).toBe(
        'docs/automations.md is neither the map nor a chapter — number it, or move it under _assets/',
    );
});

/** A decisions/ folder holding one well-formed record — the ground the decision rules judge. */
function withDecisions(overrides: Record<string, unknown> = {}) {
    return manual({
        files: [
            ...manual().files,
            'docs/decisions/',
            'docs/decisions/001-the-first-call.md',
            'docs/decisions/_template.md',
        ],
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-001: The first call',
                '',
                '**Status:** Accepted',
            ],
        },
        ...overrides,
    });
}

test('passes a well-formed decisions folder', () => {
    // Given - one record on the mold, beside the mold itself
    // Then - nothing to say
    expect(rules(withDecisions())).toEqual([]);
});

test('names a decision file that is not NNN-kebab.md', () => {
    // Given - a record named without its number
    const tree = withDecisions({
        files: [...withDecisions().files, 'docs/decisions/the-second-call.md'],
    });

    // Then - the mold of the name is stated
    expect(sentence(tree, 'docs-decision-name')).toBe(
        'docs/decisions/the-second-call.md is not NNN-kebab.md',
    );
});

test('names a decision opening on the wrong heading', () => {
    // Given - a record whose title forgets the ADR number
    const tree = withDecisions({
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# The first call',
                '',
                '**Status:** Accepted',
            ],
        },
    });

    // Then - the line it opens on, and the mold it owes
    expect(sentence(tree, 'docs-decision-heading')).toBe(
        'docs/decisions/001-the-first-call.md opens on # The first call: the mold is "# ADR-001: Title"',
    );
});

test('names a decision whose heading claims another number', () => {
    // Given - a record numbered 001 titled ADR-002
    const tree = withDecisions({
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-002: The first call',
                '',
                '**Status:** Accepted',
            ],
        },
    });

    // Then - the same rule catches the disagreement
    expect(rules(tree)).toEqual(['docs-decision-heading']);
});

test('names a decision outside the status vocabulary', () => {
    // Given - a record declaring a status nobody defined
    const tree = withDecisions({
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-001: The first call',
                '',
                '**Status:** Draft',
            ],
        },
    });

    // Then - the four the vocabulary holds
    expect(sentence(tree, 'docs-decision-status')).toBe(
        'docs/decisions/001-the-first-call.md: **Status:** is none of Proposed, Accepted, Superseded by [ADR-NNN](file.md), Deprecated',
    );
});

test('accepts a superseded status that links the record replacing it', () => {
    // Given - the one status carrying an argument, written as a citation
    const tree = withDecisions({
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-001: The first call',
                '',
                '**Status:** Superseded by [ADR-014](014-the-later-call.md)',
            ],
        },
    });

    // Then - nothing to say
    expect(rules(tree)).toEqual([]);
});

test('refuses a superseded status with no link naming the successor', () => {
    // Given - the bare form: a successor is named, but not as a place to look
    const tree = withDecisions({
        heads: {
            'docs/decisions/001-the-first-call.md': [
                '# ADR-001: The first call',
                '',
                '**Status:** Superseded by ADR-014',
            ],
        },
    });

    // Then - the missing link is the whole complaint
    expect(sentence(tree, 'docs-decision-status')).toBe(
        'docs/decisions/001-the-first-call.md: **Status:** names a successor but no link — write Superseded by [ADR-NNN](file.md)',
    );
});

test('names a number two records claim', () => {
    // Given - two records numbered 001
    const tree = withDecisions({
        files: [...withDecisions().files, 'docs/decisions/001-the-same-call.md'],
        heads: {
            ...withDecisions().heads,
            'docs/decisions/001-the-same-call.md': [
                '# ADR-001: The same call',
                '',
                '**Status:** Proposed',
            ],
        },
    });

    // Then - both claimants are named
    expect(sentence(tree, 'docs-decision-number')).toBe(
        'ADR-001 is claimed by 001-the-first-call.md and 001-the-same-call.md',
    );
});

test('names a hand-written decisions index', () => {
    // Given - a README.md listing the records
    const tree = withDecisions({ files: [...withDecisions().files, 'docs/decisions/README.md'] });

    // Then - an index is a copy, and the queue is derived
    expect(sentence(tree, 'docs-decision-index')).toBe(
        'docs/decisions/README.md is an index — an index is a copy; the queue is derived (terra <brand> decisions)',
    );
});

test('names a decisions folder with no mold', () => {
    // Given - records with no _template.md beside them
    const tree = withDecisions({
        files: withDecisions().files.filter((path) => path !== 'docs/decisions/_template.md'),
    });

    // Then - the mold sits where the record is written
    expect(sentence(tree, 'docs-template-missing')).toBe(
        'docs/decisions/_template.md is missing — the mold sits where the record is written',
    );
});

test('names a reference page carrying no generation marker', () => {
    // Given - a hand-authored page inside the projection
    const tree = manual({
        files: [...manual().files, 'docs/reference/', 'docs/reference/index.md'],
        heads: { 'docs/reference/index.md': ['# API'] },
    });

    // Then - reference/ is a projection, never authored
    expect(sentence(tree, 'docs-reference-unstamped')).toBe(
        'docs/reference/index.md carries no GENERATED marker — reference/ is a projection, never authored',
    );
});

test('passes a stamped reference page', () => {
    // Given - the marker the docs compiler writes on its first line
    const tree = manual({
        files: [...manual().files, 'docs/reference/', 'docs/reference/index.md'],
        heads: {
            'docs/reference/index.md': ['<!-- GENERATED by `typescript docs` — DO NOT EDIT -->'],
        },
    });

    // Then - nothing to say
    expect(rules(tree)).toEqual([]);
});

test('names a repository whose brief does not route to the manual', () => {
    // Given - no AGENTS.md at the root
    const tree = manual({ agents: null });

    // Then - the brief is a map, not a manual
    expect(sentence(tree, 'docs-agents-route')).toBe(
        'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
    );
});

test('names a brief that exists but routes elsewhere', () => {
    // Given - a brief restating the corpus instead of pointing at it
    const tree = manual({ agents: '# Agent brief\n\nEverything you need is right here.\n' });

    // Then - the same rule
    expect(rules(tree)).toEqual(['docs-agents-route']);
});

test('names a chapter reaching into another repository', () => {
    // Given - a chapter linking a sibling clone's page
    const tree = manual({
        links: {
            ...manual().links,
            'docs/01-architecture.md': ['../../package-test/docs/README.md'],
        },
    });

    // Then - another repository's tree is not a place this manual may reach
    expect(sentence(tree, 'docs-cross-repo-link')).toBe(
        "docs/01-architecture.md links ../../package-test/docs/README.md: another repository's tree is not a place this manual may reach",
    );
});

test('lets a chapter cite a sibling repository by url, and reach its own root', () => {
    // Given - a forge link, an anchor, and a link back up to the repository's README
    const tree = manual({
        links: {
            ...manual().links,
            'docs/01-architecture.md': [
                'https://github.com/jterrazz/jterrazz-studio/blob/main/docs/08-repo-structure.md',
                '#the-spine',
                '../README.md',
                '02-developing.md',
            ],
        },
    });

    // Then - a citation is not a reach, and the repository's own tree is fair game
    expect(rules(tree)).toEqual([]);
});
