import { describe, expect, test } from 'vitest';

import { manual, messageOf, rulesBrokenBy, violationOf } from './docs.fixtures.js';

function withPage(path: string) {
    return manual({
        files: [...manual().files, path],
        links: {
            'docs/README.md': [
                ...(manual().links['docs/README.md'] ?? []),
                path.slice('docs/'.length),
            ],
        },
    });
}

describe('docs.pages', () => {
    test('auditPages — names a page that is not kebab-case.md', () => {
        // Given - a guide with an upper-case word and an underscore
        const tree = withPage('docs/guides/Lint_presets.md');

        // Then - the mold is named
        expect(messageOf(tree, 'docs/page-named-in-kebab-case')).toBe(
            'docs/guides/Lint_presets.md is not kebab-case.md — lowercase words, single hyphens, no number: the map gives the order',
        );
    });

    test('auditPages — names a page that carries a number', () => {
        // Given - a tutorial numbered for its place in a reading order
        const tree = withPage('docs/start/01-first-project.md');

        // Then - the order is the map's, never the name's
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/page-named-in-kebab-case']);
    });

    test('auditPages — lets a page name carry a digit inside a word', () => {
        // Given - a reference page naming a protocol version
        const tree = withPage('docs/reference/http2-headers.md');

        // Then - only a leading number is refused
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('auditPages — names a folder nested inside a section, once', () => {
        // Given - a guides/ that hides a section of its own, holding a page
        const tree = manual({
            files: [
                ...manual().files,
                'docs/guides/recipes/',
                'docs/guides/recipes/cache.md',
                'docs/guides/recipes/old/',
                'docs/guides/recipes/old/cache.md',
            ],
        });

        // Then - the folder is named, and what it holds is the folder's
        expect(violationOf(tree, 'docs/section-is-flat')).toStrictEqual({
            message:
                'docs/guides/recipes/ is a folder inside guides/ — a section holds pages, and a sub-folder is a section hiding inside another',
            path: 'docs/guides/recipes/',
        });
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/section-is-flat']);
    });

    test('auditPages — names each missing required page', () => {
        // Given - a manual holding the architecture alone
        const tree = manual({
            files: ['docs/', 'docs/README.md', 'docs/concepts/', 'docs/concepts/architecture.md'],
            links: { 'docs/README.md': ['concepts/architecture.md'] },
        });

        // Then - the develop and test guides are each asked for
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/required-pages-present',
            'docs/required-pages-present',
        ]);
        expect(violationOf(tree, 'docs/required-pages-present')).toStrictEqual({
            message:
                'guides/develop.md is missing — every manual holds concepts/architecture.md, guides/develop.md and guides/test.md',
            path: 'docs/guides/develop.md',
        });
    });

    test('auditPages — asks for guides/release.md from a repository that ships an image', () => {
        // Given - a Dockerfile at the root or at a workspace member's root
        const tree = manual({
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the reason it is asked for is named
        expect(violationOf(tree, 'docs/release-guide-present-when-shipping')).toStrictEqual({
            message: 'guides/release.md is missing — this repository ships an image (a Dockerfile)',
            path: 'docs/guides/release.md',
        });
    });

    test('auditPages — asks for guides/release.md from a repository that declares a deployment', () => {
        // Given - an .infrastructure/ folder
        const tree = manual({
            ships: { dockerfile: false, infrastructure: true, publishable: false },
        });

        // Then - the second clause of the presence test speaks
        expect(messageOf(tree, 'docs/release-guide-present-when-shipping')).toBe(
            'guides/release.md is missing — this repository ships a deployment (.infrastructure/)',
        );
    });

    test('auditPages — asks for guides/release.md from a published package', () => {
        // Given - a root that declares a kind npm publishes
        const tree = manual({
            ships: { dockerfile: false, infrastructure: false, publishable: true },
        });

        // Then - the third clause of the presence test speaks
        expect(messageOf(tree, 'docs/release-guide-present-when-shipping')).toBe(
            'guides/release.md is missing — this repository ships a published package (it declares a library or a cli)',
        );
    });

    test('auditPages — asks nothing of a shipping repository that carries its release guide', () => {
        // Given - an image, and the release guide beside the required pages
        const tree = manual({
            ...withPage('docs/guides/release.md'),
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the presence test is met
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('auditPages — never asks for guides/release.md from a repository that ships nothing', () => {
        // Given - no image, no infrastructure, no kind npm publishes
        // Then - the gate only ever requires; it never forbids a release guide either
        expect(rulesBrokenBy(manual())).toStrictEqual([]);
        expect(rulesBrokenBy(withPage('docs/guides/release.md'))).toStrictEqual([]);
    });

    test('auditPages — names a page that is a journal, not a subject', () => {
        // Given - a concept page recording a design exploration
        const tree = withPage('docs/concepts/design-exploration.md');

        // Then - the word is named, and so is where that content belongs
        expect(messageOf(tree, 'docs/page-names-a-subject')).toBe(
            "docs/concepts/design-exploration.md names a journal, not a subject — exploration; the record is an ADR, the history is git's",
        );
    });

    test.each([
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
    ])('auditPages — names a page carrying the journal word %s', (word) => {
        // Given - a concept page named after the word, beside a hyphenated one
        const tree = withPage(`docs/concepts/${word}.md`);

        // Then - the word is named
        expect(messageOf(tree, 'docs/page-names-a-subject')).toBe(
            `docs/concepts/${word}.md names a journal, not a subject — ${word}; the record is an ADR, the history is git's`,
        );
    });

    test.each(['docs/guides/lint.md.bak', 'docs/guides/lint-Presets.md', 'docs/guides/lint-9.md'])(
        'auditPages — judges the name %s whole',
        (path) => {
            // Given - a page whose name breaks the mold at its end, or in a later word
            const tree = withPage(path);

            // Then - only the page named in kebab-case passes, a digit-led word apart
            expect(rulesBrokenBy(tree)).toStrictEqual(
                path.endsWith('9.md') ? [] : ['docs/page-named-in-kebab-case'],
            );
        },
    );
});
