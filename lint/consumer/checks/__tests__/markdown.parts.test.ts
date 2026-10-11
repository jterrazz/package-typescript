import { describe, expect, test } from 'vitest';

import {
    QUALIFIED_BY_REPOSITORY,
    unlinkedReferences,
    withoutGenerated,
} from '../markdown.parts.js';

const readSkill = (path: string): null | string =>
    path === 'skills/orders/SKILL.md' ? 'See references/linked.md for the rest.' : null;

const readNothing = (): null | string => null;

describe('markdown.parts', () => {
    test('withoutGenerated — a generated region keeps its lines and loses its text, markers with attributes included, and the text outside it stands', () => {
        // Given - a page with two regions, one whose marker carries attributes, and prose around them
        const page = [
            'before',
            '<!-- GENERATED:table  rows=3 -->',
            'row one',
            'row two',
            '<!-- /GENERATED:table -->',
            'between',
            '<!-- GENERATED:list -->',
            '<!-- /GENERATED:list -->',
            'after',
        ].join('\n');

        // Then - the regions are blank lines, counted, and the prose stands
        expect(withoutGenerated(page)).toBe('before\n\n\n\n\nbetween\n\n\nafter');
    });

    test.each([
        ['a repository name', '`package-typescript` `', true],
        ['a scoped package and a path', '`@jterrazz/typescript` `', true],
        ['several spaces between the spans', '`package-test`   `', true],
        ['a name with a dot and a hyphen after a slash', '`a/b.c-d` `', true],
        ['text after the opening backtick', '`package-test` `docs/x.md', false],
        ['no space between the spans', '`package-test``', false],
        ['a span that is no name', '`a b` `', false],
    ])('a name before a path — %s', (_case, text, expected) => {
        // Given - the text before a path span
        // Then - it is qualified by a repository only when it ends on that name's span and the opening backtick
        expect(QUALIFIED_BY_REPOSITORY.test(text)).toBe(expected);
    });

    test('unlinkedReferences — a reference page of a skill must be named by the line of its SKILL.md, and a file that is no such page asks nothing', () => {
        // Given - a skill linking one of its two pages, a file that only looks like a page, and pages nested one level too deep or too high
        const files = [
            'skills/orders/references/linked.md',
            'skills/orders/references/forgotten.md',
            'skills/orders/references/notes.md5',
            'docs/skills/orders/references/outside.md',
            'skills/orders/references/deep/page.md',
            'skills/SKILL.md',
        ];

        // Then - the forgotten page alone is reported, against the SKILL.md that should name it
        expect(unlinkedReferences(files, readSkill)).toStrictEqual([
            {
                message:
                    'skills/orders/references/forgotten.md is linked from no line of skills/orders/SKILL.md',
                path: 'skills/orders/SKILL.md',
                rule: 'markdown/skill-links-its-references',
            },
        ]);
    });

    test('unlinkedReferences — a skill with no SKILL.md links nothing', () => {
        // Given - a page whose skill has no SKILL.md to read
        // Then - the page is reported
        expect(unlinkedReferences(['skills/orders/references/a.md'], readNothing)).toHaveLength(1);
    });
});
