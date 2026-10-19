import { describe, expect, test } from 'vitest';

import { lessonParts } from '../../../kit/catalogue/lesson.js';
import { skillFrontmatter } from '../markdown.skills.js';

const SKILL = 'skills/shop/SKILL.md';

const foundOf = (
    path: string,
    markdown: string,
): [number, string | undefined, string | undefined][] =>
    skillFrontmatter(path, markdown).map(({ line, message }) => {
        const parts = lessonParts(message);

        return [line, parts?.found, parts?.fix];
    });

describe('markdown.skills', () => {
    test('skillFrontmatter — a frontmatter that parses and states a name and a description passes, quoted or closing the file', () => {
        // Given - a description quoted around its colon, then a frontmatter that ends the file
        const pages = [
            '---\nname: shop\ndescription: "Use when: an order is placed"\n---\n\n# Shop\n',
            '---\nname: shop\ndescription: Use for orders\n---',
        ];

        // Then - nothing to refuse
        expect(pages.flatMap((page) => skillFrontmatter(SKILL, page))).toStrictEqual([]);
    });

    test('skillFrontmatter — reads a SKILL.md at the root of a skill folder, wherever the skills folder sits, and no other page', () => {
        // Given - a page with no frontmatter, at every kind of path
        const paths = [
            SKILL,
            'packages/kit/skills/shop/SKILL.md',
            'skills/shop/references/SKILL.md',
            'skills/shop/README.md',
            'skills/shop/SKILL.md.bak',
            'docs/SKILL.md',
        ];

        // Then - the two skill entries are judged, the rest left alone
        expect(paths.map((path) => skillFrontmatter(path, '# Shop\n').length)).toStrictEqual([
            1, 1, 0, 0, 0, 0,
        ]);
    });

    test('skillFrontmatter — a frontmatter that is no YAML is refused at the line the parser stopped on, its message without the position the parser printed, in four parts', () => {
        // Given - an unquoted description holding `: `, the 2026-10-19 case
        const page =
            '---\nname: shop\ndescription: Use when: an order is placed\nlicense: MIT\n---\n';

        // Then - the line of the description in the file, the lesson whole
        expect(skillFrontmatter(SKILL, page)).toStrictEqual([
            {
                line: 3,
                message:
                    'found: the frontmatter is no YAML: Nested mappings are not allowed in compact mappings · why: an agent finds a skill by the name and the description its frontmatter states, and an installer that cannot read them keeps the copy it had, so the change reaches no one and nothing says so · fix: quote a value that holds `: ` or opens on a YAML indicator (`description: "Use when: ..."`), then run again · read: docs/reference/quality-checks.md#what-the-prose-gate-adds',
                rule: 'markdown/skill-frontmatter-reads',
            },
        ]);
    });

    test('skillFrontmatter — a page with no frontmatter, and one that states no name or no description, each name what is missing', () => {
        // Given - no frontmatter, one after the title, a blank name and no description, a description that is no string, and a list
        const pages = [
            '# Shop\n',
            '# Shop\n---\nname: shop\ndescription: Use for orders\n---\n',
            '---\nname: "  "\n---\n',
            '---\nname: shop\ndescription: 3\n---\n',
            '---\n- shop\n---\n',
        ];
        const none = 'open it on a frontmatter that states its `name` and its `description`';
        const missing = 'give it a `name` and a `description`, each a string that says something';

        // Then - each at the first line, with its fix
        expect(pages.map((page) => foundOf(SKILL, page))).toStrictEqual([
            [[1, 'the page opens on no frontmatter between two `---` lines', none]],
            [[1, 'the page opens on no frontmatter between two `---` lines', none]],
            [[1, 'the frontmatter states no `name` and no `description`', missing]],
            [[1, 'the frontmatter states no `description`', missing]],
            [[1, 'the frontmatter states no `name` and no `description`', missing]],
        ]);
    });
});
