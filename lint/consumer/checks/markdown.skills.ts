import { parseDocument } from 'yaml';

import { refusal } from '../../kit/catalogue/lesson.js';
import { objectOf } from '../../kit/project/json.js';

type Found = { line: number; message: string; rule: string };

const SKILL_ENTRY = /(?:^|\/)skills\/[^/]+\/SKILL\.md$/u;

const FRONTMATTER = /^---\n(?<yaml>[\s\S]*?)\n---(?:\n|$)/u;

const PARSER_POSITION = / at line [\s\S]*/u;

const STATED = ['name', 'description'] as const;

const QUOTE_IT =
    'quote a value that holds `: ` or opens on a YAML indicator (`description: "Use when: ..."`), then run again';

// outside: a skill installer reads the frontmatter to install the skill, and one that cannot read it keeps the copy it installed before (16 skills of the estate on 2026-10-19).
const frontmatterFinding = (line: number, found: string, fix: string): Found => ({
    line,
    message: refusal({
        fix,
        found,
        read: 'docs/reference/quality-checks.md#what-the-prose-gate-adds',
        why: 'an agent finds a skill by the name and the description its frontmatter states, and an installer that cannot read them keeps the copy it had, so the change reaches no one and nothing says so',
    }),
    rule: 'markdown/skill-frontmatter-reads',
});

/** What keeps a skill's SKILL.md from opening on a YAML frontmatter that parses and states its name and description. */
export function skillFrontmatter(path: string, markdown: string): Found[] {
    if (!SKILL_ENTRY.test(path)) {
        return [];
    }
    // Stryker disable next-line OptionalChaining: a match always carries its groups, so the second link only satisfies the type
    const yaml = FRONTMATTER.exec(markdown)?.groups?.yaml;
    if (yaml === undefined) {
        return [
            frontmatterFinding(
                1,
                'the page opens on no frontmatter between two `---` lines',
                'open it on a frontmatter that states its `name` and its `description`',
            ),
        ];
    }
    const document = parseDocument(yaml);
    const [error] = document.errors;
    if (error !== undefined) {
        const line = yaml.slice(0, error.pos[0]).split('\n').length + 1;

        return [
            frontmatterFinding(
                line,
                `the frontmatter is no YAML: ${error.message.replace(PARSER_POSITION, '')}`,
                QUOTE_IT,
            ),
        ];
    }
    const fields = objectOf(document.toJS());
    const missing = STATED.filter((key) => {
        const value = fields[key];

        return typeof value !== 'string' || value.trim() === '';
    });

    return missing.length === 0
        ? []
        : [
              frontmatterFinding(
                  1,
                  `the frontmatter states no ${missing.map((key) => `\`${key}\``).join(' and no ')}`,
                  'give it a `name` and a `description`, each a string that says something',
              ),
          ];
}
