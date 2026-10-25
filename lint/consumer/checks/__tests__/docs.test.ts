import { describe, expect, test } from 'vitest';

import { auditDocs } from '../docs.js';
import { manual, rulesBrokenBy } from './docs.fixtures.js';

describe('docs', () => {
    test('passes the smallest compliant manual', () => {
        // Given - a map, the three required pages, a brief that routes into them
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
                    'docs/ is missing: every repository carries its own manual, starting at docs/README.md',
                path: 'docs/',
                rule: 'docs/manual-present',
            },
        ]);
    });

    test('names a docs/ with no map', () => {
        // Given - pages with no README.md to route into them
        const tree = manual({
            files: manual().files.filter((path) => path !== 'docs/README.md'),
            links: {},
        });

        // Then - the map is the one file an outside corpus points at
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/README.md is missing: the map is the one file an outside corpus points at',
                path: 'docs/README.md',
                rule: 'docs/map-present',
            },
        ]);
    });

    test('names a map row with no page, and a page with no row', () => {
        // Given - a map routing to the release guide while the test guide has no row
        const tree = manual({
            links: {
                'docs/README.md': [
                    'concepts/architecture.md',
                    'guides/develop.md',
                    'guides/release.md',
                ],
            },
        });

        // Then - each side of the disagreement is named
        expect(auditDocs(tree)).toStrictEqual([
            {
                message: 'docs/README.md and the pages disagree: guides/release.md has no file',
                path: 'docs/README.md',
                rule: 'docs/map-matches-pages',
            },
            {
                message: 'docs/README.md and the pages disagree: guides/test.md has no row',
                path: 'docs/README.md',
                rule: 'docs/map-matches-pages',
            },
        ]);
    });

    test('names every page of a map that links nothing', () => {
        // Given - a map with no link at all
        const tree = manual({ links: {} });

        // Then - each page lacks its row, and nothing else is said
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/map-matches-pages',
            'docs/map-matches-pages',
            'docs/map-matches-pages',
        ]);
    });

    test('reads a map row through its ./, its anchor, and an anchor alone', () => {
        // Given - rows written relative, one pointing into a heading, and a link to the map's own heading
        const tree = manual({
            links: {
                'docs/README.md': [
                    './concepts/architecture.md',
                    'guides/develop.md#the-loop',
                    'guides/test.md',
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

        // Then - the map routes to its pages and decisions/, and nothing else
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/README.md links ../README.md: the map routes to its own pages and nothing else',
                path: 'docs/README.md',
                rule: 'docs/map-links-only-pages',
            },
        ]);
    });

    test('names a map link to a page outside the sections', () => {
        // Given - a map routing to a page beside itself
        const tree = manual({
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), 'notes-v2.md'],
            },
        });

        // Then - it is not read as a row
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/map-links-only-pages']);
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

    test('reads a row of every section', () => {
        // Given - a tutorial and a reference page beside the required three, each with its row
        const tree = manual({
            files: [
                ...manual().files,
                'docs/reference/',
                'docs/reference/commands.md',
                'docs/start/',
                'docs/start/first-project.md',
            ],
            links: {
                'docs/README.md': [
                    'start/first-project.md',
                    ...(manual().links['docs/README.md'] ?? []),
                    'reference/commands.md',
                ],
            },
        });

        // Then - every page has its row
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('names a subfolder that is none of the sections', () => {
        // Given - a folder of dated QA passes under docs/
        const tree = manual({
            files: [...manual().files, 'docs/2026-qa/', 'docs/2026-qa/01-january.md'],
        });

        // Then - the folders a manual may hold are named
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/2026-qa/ is not one of start/, guides/, concepts/, reference/, decisions/, _assets/',
                path: 'docs/2026-qa/',
                rule: 'docs/no-unknown-subfolder',
            },
        ]);
    });

    test('names a file under docs/ that is not the map', () => {
        // Given - a page dropped beside the map
        const tree = manual({ files: [...manual().files, 'docs/automations-v2.md'] });

        // Then - it is asked to find its section
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'docs/automations-v2.md sits outside the sections; move it under start/, guides/, concepts/ or reference/, or under _assets/ if a page embeds it',
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
                'docs/_assets/docs/guides/',
                'docs/_assets/docs/guides/Notes.md',
            ],
        });

        // Then - what sits below a subfolder is the subfolder's
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('names a repository whose brief does not route to the manual', () => {
        // Given - no CLAUDE.md at the root
        const tree = manual({ brief: null });

        // Then - the brief is a map, not a manual
        expect(auditDocs(tree)).toStrictEqual([
            {
                message:
                    'CLAUDE.md does not route to docs/README.md: the brief is a map, not a manual',
                path: 'CLAUDE.md',
                rule: 'docs/brief-routes-to-the-map',
            },
        ]);
    });

    test('names a brief that exists but routes elsewhere', () => {
        // Given - a brief restating the corpus instead of pointing at it
        const tree = manual({ brief: '# Agent brief\n\nEverything you need is right here.\n' });

        // Then - the same rule
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/brief-routes-to-the-map']);
    });

    test('names an AGENTS.md left beside the brief', () => {
        // Given - a compliant CLAUDE.md, and the brief's old name still at the root
        const tree = manual({ staleBrief: true });

        // Then - the straggler is named, so the old name dies everywhere
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/no-agents-brief']);
    });
});
