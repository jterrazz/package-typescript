import { describe, expect, test } from 'vitest';

import { manual, messageOf, rulesBrokenBy, withDecisions } from './docs.fixtures.js';

describe('auditLinks', () => {
    test('names a page reaching into another repository', () => {
        // Given - a page linking a sibling clone's page
        const tree = manual({
            links: {
                ...manual().links,
                'docs/concepts/architecture.md': ['../../../package-test/docs/README.md'],
            },
        });

        // Then - another repository's tree is not a place this manual may reach
        expect(messageOf(tree, 'docs/no-cross-repository-link')).toBe(
            "docs/concepts/architecture.md links ../../../package-test/docs/README.md: another repository's tree is not a place this manual may reach",
        );
    });

    test('resolves a link through its ./, its doubled slashes, and every climb', () => {
        // Given - three reaches out of the repository, each spelled a way a segment walk must read
        const reaches = [
            './../../../package-test/README.md',
            '..//..//..//package-test/README.md',
            '../../../../estate/README.md',
            '/README.md',
        ];
        const tree = manual({
            links: { ...manual().links, 'docs/concepts/architecture.md': reaches },
        });

        // Then - each one is named
        expect(rulesBrokenBy(tree)).toStrictEqual(
            reaches.map(() => 'docs/no-cross-repository-link'),
        );
    });

    test('resolves a link from the folder of the page that holds it', () => {
        // Given - a decision two folders deep reaching the repository root, and a root folder whose name opens on dots
        const tree = withDecisions({
            links: {
                ...manual().links,
                'docs/decisions/001-the-first-call.md': [
                    '../../README.md',
                    '../../..notes/draft.md',
                ],
            },
        });

        // Then - both stay inside the repository
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('lets a page cite a sibling repository by url, and reach its own root', () => {
        // Given - a forge link, an anchor, and a link back up to the repository's README
        const tree = manual({
            links: {
                ...manual().links,
                'docs/concepts/architecture.md': [
                    'https://github.com/jterrazz/jterrazz-studio/blob/main/docs/11-repo-structure.md',
                    '#the-judging-layer',
                    '../../README.md',
                    '../guides/develop.md',
                ],
            },
        });

        // Then - a citation is not a reach, and the repository's own tree is fair game
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });
});
