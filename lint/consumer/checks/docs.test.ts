import { describe, expect, test } from 'vitest';

import { manual, messageOf, rulesBrokenBy } from './docs.fixtures.js';
import { auditDocs } from './docs.js';

describe('docs', () => {
    test('passes the smallest compliant manual', () => {
        // Given - a map, the three spine chapters, a brief that routes into them
        // Then - nothing to say
        expect(auditDocs(manual())).toStrictEqual([]);
    });

    test('names a repository with no docs/, and nothing else', () => {
        // Given - no manual at all
        const tree = manual({ files: [] });

        // Then - one violation; every other rule would restate the absence
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/ is missing — every repository carries its own manual, starting at docs/README.md',
                path: 'docs/',
                rule: 'docs/manual-present',
            },
        ]);
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
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/README.md is missing — the map is the one file an outside corpus points at',
                path: 'docs/README.md',
                rule: 'docs/map-present',
            },
        ]);
    });

    test('names a map row with no chapter, and a chapter with no row', () => {
        // Given - a map routing to 04 while 03 has no row
        const tree = manual({
            links: {
                'docs/README.md': ['01-architecture.md', '02-developing.md', '04-operating.md'],
            },
        });

        // Then - each side of the disagreement is named
        expect(auditDocs(tree)).toStrictEqual([
            {
                message: 'docs/README.md and the chapters disagree: 04-operating.md has no file',
                path: 'docs/README.md',
                rule: 'docs/map-matches-chapters',
            },
            {
                message: 'docs/README.md and the chapters disagree: 03-testing.md has no row',
                path: 'docs/README.md',
                rule: 'docs/map-matches-chapters',
            },
        ]);
    });

    test('names every chapter of a map that links nothing', () => {
        // Given - a map with no link at all
        const tree = manual({ links: {} });

        // Then - each chapter lacks its row, and nothing else is said
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/map-matches-chapters',
            'docs/map-matches-chapters',
            'docs/map-matches-chapters',
        ]);
    });

    test('reads a map row through its ./, its anchor, and an anchor alone', () => {
        // Given - rows written relative, one pointing into a section, and a link to the map's own heading
        const tree = manual({
            links: {
                'docs/README.md': [
                    './01-architecture.md',
                    '02-developing.md#the-loop',
                    '03-testing.md',
                    '#reading-order',
                    'decisions/001-the-first-call.md',
                ],
            },
        });

        // Then - every one routes into the manual
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('names a map link that leaves the manual', () => {
        // Given - a map routing to the repository's own README
        const tree = manual({
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '../README.md'],
            },
        });

        // Then - the map routes to chapters and decisions/, and nothing else
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/README.md links ../README.md: the map routes to its own chapters and nothing else',
                path: 'docs/README.md',
                rule: 'docs/map-links-only-chapters',
            },
        ]);
    });

    test('names a map link to a page that is no chapter', () => {
        // Given - a map routing to an unnumbered page that carries a digit
        const tree = manual({
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), 'notes-v2.md'],
            },
        });

        // Then - it is not read as a row
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/map-links-only-chapters']);
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

    test('names a subfolder that is none of the two', () => {
        // Given - a folder of dated QA passes under docs/
        const tree = manual({
            files: [...manual().files, 'docs/2026-qa/', 'docs/2026-qa/01-january.md'],
        });

        // Then - the two are named, and the folder is no chapter
        expect(auditDocs(tree)).toStrictEqual([
            {
                message: 'docs/2026-qa/ is not one of decisions/, _assets/',
                path: 'docs/2026-qa/',
                rule: 'docs/no-unknown-subfolder',
            },
        ]);
    });

    test('names a file under docs/ that is neither the map nor a chapter', () => {
        // Given - an unnumbered page dropped beside the chapters
        const tree = manual({ files: [...manual().files, 'docs/automations-v2.md'] });

        // Then - number it, or move it out of the chapter space
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/automations-v2.md is neither the map nor a chapter — number it, or move it under _assets/',
                path: 'docs/automations-v2.md',
                rule: 'docs/no-loose-file',
            },
        ]);
    });

    test('judges only the direct children of docs/', () => {
        // Given - an asset folder that nests a folder of its own named docs/
        const tree = manual({
            files: [
                ...manual().files,
                'docs/_assets/',
                'docs/_assets/docs/',
                'docs/_assets/docs/notes.md',
            ],
        });

        // Then - what sits below a subfolder is the subfolder's
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
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
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'AGENTS.md does not route to docs/README.md — the brief is a map, not a manual',
                path: 'AGENTS.md',
                rule: 'docs/agents-route-to-the-map',
            },
        ]);
    });

    test('names a brief that exists but routes elsewhere', () => {
        // Given - a brief restating the corpus instead of pointing at it
        const tree = manual({ agents: '# Agent brief\n\nEverything you need is right here.\n' });

        // Then - the same rule
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/agents-route-to-the-map']);
    });
});
