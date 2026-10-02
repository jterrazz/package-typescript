import { describe, expect, test } from 'vitest';

import { auditDocs } from './docs.js';
import type { DocsTree } from './docs.js';

// The smallest compliant manual; each test breaks exactly one thing.
function manual(overrides: Partial<DocsTree> = {}): DocsTree {
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

function rulesBrokenBy(tree: DocsTree) {
    return auditDocs(tree).map((violation) => violation.rule);
}

function messageOf(tree: DocsTree, rule: string) {
    return auditDocs(tree).find((violation) => violation.rule === rule)?.message;
}

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
describe('docs', () => {
    test('passes the smallest compliant manual', () => {
        // Given - a map, the three spine chapters, a brief that routes into them
        // Then - nothing to say
        expect(auditDocs(manual())).toStrictEqual([]);
    });

    test('names a docs/ with no map', () => {
        // Given - chapters with no README.md to route into them
        const tree = manual({
            files: [
                'docs/',
                'docs/01-architecture.md',
                'docs/02-developing.md',
                'docs/03-testing.md',
            ],
            links: {},
        });

        // Then - the map is the one file an outside corpus points at
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/map-present']);
        expect(messageOf(tree, 'docs/map-present')).toBe(
            'docs/README.md is missing — the map is the one file an outside corpus points at',
        );
    });

    test('names a map link that leaves the manual', () => {
        // Given - a map routing to the repository's own README
        const tree = manual({
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '../README.md'],
            },
        });

        // Then - the map routes to chapters and decisions/, and nothing else
        expect(messageOf(tree, 'docs/map-links-only-chapters')).toBe(
            'docs/README.md links ../README.md: the map routes to its own chapters and nothing else',
        );
    });

    test('lets the map route to decisions/', () => {
        // Given - the one folder a map may point at
        const tree = manual({
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), 'decisions/'],
            },
        });

        // Then - it is not foreign
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('names a map link into a generated reference', () => {
        // Given - a map routing to an API projection
        const tree = manual({
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    'reference/index.md',
                ],
            },
        });

        // Then - the map routes to its own chapters and nothing else
        expect(messageOf(tree, 'docs/map-links-only-chapters')).toBe(
            'docs/README.md links reference/index.md: the map routes to its own chapters and nothing else',
        );
    });

    test('names a chapter that is not NN-kebab.md', () => {
        // Given - a fourth chapter with one digit and an upper-case word
        const tree = manual({
            files: [...manual().files, 'docs/4-Lint_presets.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '4-Lint_presets.md',
                ],
            },
        });

        // Then - the mold is named, and the number it took is still judged
        expect(messageOf(tree, 'docs/chapter-named-by-number-and-subject')).toBe(
            'docs/4-Lint_presets.md is not NN-kebab.md — two digits, lowercase words, single hyphens',
        );
    });

    test('names chapter numbers that skip, and numbers claimed twice', () => {
        // Given - two chapters numbered 05 and none numbered 04
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md', 'docs/05-presets.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '05-building.md',
                    '05-presets.md',
                ],
            },
        });

        // Then - one sentence about the whole run
        expect(messageOf(tree, 'docs/chapters-numbered-contiguously')).toBe(
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
        expect(messageOf(tree, 'docs/spine-number-reserved')).toBe(
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
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/spine-chapters-present',
            'docs/spine-chapters-present',
        ]);
        expect(messageOf(tree, 'docs/spine-chapters-present')).toBe(
            '02-developing.md is missing — the spine is architecture, developing, testing',
        );
    });

    test('asks for 04-operating.md from a repository that ships an image', () => {
        // Given - a Dockerfile at the root or at a workspace member's root
        const tree = manual({
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the reason it is asked for is named
        expect(messageOf(tree, 'docs/operating-chapter-present-when-shipping')).toBe(
            '04-operating.md is missing — this repository ships an image (a Dockerfile)',
        );
    });

    test('asks for 04-operating.md from a published package', () => {
        // Given - a manifest that never says it is private
        const tree = manual({
            ships: { dockerfile: false, infrastructure: false, publishable: true },
        });

        // Then - the third clause of the presence test speaks
        expect(messageOf(tree, 'docs/operating-chapter-present-when-shipping')).toBe(
            '04-operating.md is missing — this repository ships a published package (package.json is not private)',
        );
    });

    test('never asks for 04-operating.md from a repository that ships nothing', () => {
        // Given - no image, no infrastructure, a private manifest
        // Then - the lint only ever requires; it never forbids a 04 either
        expect(rulesBrokenBy(manual())).toStrictEqual([]);
    });

    test('lets 05 follow 03 directly when the repository ships nothing', () => {
        // Given - 01-03 then 05, no 04 chapter, nothing that would ask for one
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md'],
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '05-building.md'],
            },
        });

        // Then - 04 is the one gap the numbering excuses
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('still asks for 04-operating.md from that same shape once it ships', () => {
        // Given - the same 01-03 + 05 shape, but an image this time
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md'],
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '05-building.md'],
            },
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the numbering stays clean; only the presence test speaks
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/operating-chapter-present-when-shipping']);
    });

    test('refuses a gap at 05 even though 04 may be absent', () => {
        // Given - 01-03 then 06, skipping past the one number the spine excuses
        const tree = manual({
            files: [...manual().files, 'docs/06-quality-checks.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '06-quality-checks.md',
                ],
            },
        });

        // Then - only 04 is excused; 05 still has to be there
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/chapters-numbered-contiguously']);
    });

    test('names a chapter that is a journal, not a subject', () => {
        // Given - a fourth chapter recording a design exploration
        const tree = manual({
            files: [...manual().files, 'docs/04-design-exploration.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '04-design-exploration.md',
                ],
            },
        });

        // Then - the word is named, and so is where that content belongs
        expect(messageOf(tree, 'docs/chapter-names-a-subject')).toBe(
            "docs/04-design-exploration.md names a journal, not a subject — exploration; the record is an ADR, the history is git's",
        );
    });

    test('names a subfolder that is none of the two', () => {
        // Given - a folder of dated QA passes under docs/
        const tree = manual({ files: [...manual().files, 'docs/qa/', 'docs/qa/2026-01.md'] });

        // Then - the two are named
        expect(messageOf(tree, 'docs/no-unknown-subfolder')).toBe(
            'docs/qa/ is not one of decisions/, _assets/',
        );
    });

    test('names a file under docs/ that is neither the map nor a chapter', () => {
        // Given - an unnumbered page dropped beside the chapters
        const tree = manual({ files: [...manual().files, 'docs/automations.md'] });

        // Then - number it, or move it out of the chapter space
        expect(messageOf(tree, 'docs/no-loose-file')).toBe(
            'docs/automations.md is neither the map nor a chapter — number it, or move it under _assets/',
        );
    });

    test('passes a well-formed decisions folder', () => {
        // Given - one record on the mold, beside the mold itself
        // Then - nothing to say
        expect(rulesBrokenBy(withDecisions())).toStrictEqual([]);
    });

    test('names a decision file that is not NNN-kebab.md', () => {
        // Given - a record named without its number
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/the-second-call.md'],
        });

        // Then - the mold of the name is stated
        expect(messageOf(tree, 'docs/decision-named-by-number-and-subject')).toBe(
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
        expect(messageOf(tree, 'docs/decision-heading-carries-its-number')).toBe(
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
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-heading-carries-its-number']);
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
        expect(messageOf(tree, 'docs/decision-status-known')).toBe(
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
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
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
        expect(messageOf(tree, 'docs/decision-status-known')).toBe(
            'docs/decisions/001-the-first-call.md: **Status:** names a successor but no link — write Superseded by [ADR-NNN](file.md)',
        );
    });

    test('passes an empty decisions folder', () => {
        // Given - the folder exists but holds no record yet
        const tree = manual({ files: [...manual().files, 'docs/decisions/'] });

        // Then - a folder with nothing to number has no sequence to break
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-template-present']);
    });

    test('passes a decisions folder holding only the template', () => {
        // Given - the mold, and not a single record beside it
        const tree = manual({
            files: [...manual().files, 'docs/decisions/', 'docs/decisions/_template.md'],
        });

        // Then - nothing to say
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('refuses a decision sequence that starts above 001', () => {
        // Given - 006 and 008, with nothing numbered before them
        const tree = withDecisions({
            files: [
                ...manual().files,
                'docs/decisions/',
                'docs/decisions/006-the-sixth-call.md',
                'docs/decisions/008-the-eighth-call.md',
                'docs/decisions/_template.md',
            ],
            heads: {
                'docs/decisions/006-the-sixth-call.md': [
                    '# ADR-006: The sixth call',
                    '',
                    '**Status:** Accepted',
                ],
                'docs/decisions/008-the-eighth-call.md': [
                    '# ADR-008: The eighth call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - the same rule, from an offset start
        expect(messageOf(tree, 'docs/decisions-numbered-contiguously')).toBe(
            'docs/decisions/ numbers run 006, 008: they run from 001 with no gap — a decision that moved folders takes the next number where it lands',
        );
    });

    test('lets a duplicated number pass the sequence check on its own', () => {
        // Given - two records claiming 001, and none other — the set is just {001}
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

        // Then - docs/decision-number-unique still refuses it; the sequence itself is not the gap
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-number-unique']);
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
        expect(messageOf(tree, 'docs/decision-number-unique')).toBe(
            'ADR-001 is claimed by 001-the-first-call.md and 001-the-same-call.md',
        );
    });

    test('names a hand-written decisions index', () => {
        // Given - a README.md listing the records
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/README.md'],
        });

        // Then - an index is a copy, and the queue is derived
        expect(messageOf(tree, 'docs/decision-listed-in-the-map')).toBe(
            'docs/decisions/README.md is an index — an index is a copy; the queue is derived (terra <brand> decisions)',
        );
    });

    test('names a decisions folder with no mold', () => {
        // Given - records with no _template.md beside them
        const tree = withDecisions({
            files: withDecisions().files.filter((path) => path !== 'docs/decisions/_template.md'),
        });

        // Then - the mold sits where the record is written
        expect(messageOf(tree, 'docs/decision-template-present')).toBe(
            'docs/decisions/_template.md is missing — the mold sits where the record is written',
        );
    });

    test('names a generated reference, stamped or not', () => {
        // Given - the projection a docs compiler wrote, with its marker
        const tree = manual({
            files: [...manual().files, 'docs/reference/', 'docs/reference/index.md'],
            heads: {
                'docs/reference/index.md': [
                    '<!-- GENERATED by `typescript docs` — DO NOT EDIT -->',
                ],
            },
        });

        // Then - the API is the types, and the folder is refused once, by its own rule
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/no-generated-reference']);
        expect(messageOf(tree, 'docs/no-generated-reference')).toBe(
            'docs/reference/ is a generated API reference — the API is the types, and the manual holds no copy of them',
        );
    });

    test('names a repository whose brief does not route to the manual', () => {
        // Given - no AGENTS.md at the root
        const tree = manual({ agents: null });

        // Then - the brief is a map, not a manual
        expect(messageOf(tree, 'docs/agents-route-to-the-map')).toBe(
            'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
        );
    });

    test('names a brief that exists but routes elsewhere', () => {
        // Given - a brief restating the corpus instead of pointing at it
        const tree = manual({ agents: '# Agent brief\n\nEverything you need is right here.\n' });

        // Then - the same rule
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/agents-route-to-the-map']);
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
        expect(messageOf(tree, 'docs/no-cross-repository-link')).toBe(
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
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });
});
