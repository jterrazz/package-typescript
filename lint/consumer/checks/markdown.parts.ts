import type { Finding } from '../../kit/checker/pass.js';

// outside: a generated region is written between markers by the program that owns it (`<!-- GENERATED:name -->` ... `<!-- /GENERATED:name -->`): its text is that program's, and a page-level rule would only ask the page to fight it.
const GENERATED_REGION = /<!-- GENERATED:(?<name>\S+)[^>]*-->.*?<!-- \/GENERATED:\k<name> -->/gsu;

export const withoutGenerated = (markdown: string): string =>
    markdown.replaceAll(GENERATED_REGION, (region) => region.replaceAll(/[^\n]/gu, ''));

// invariant: a page named by a code span qualified with another repository's name (`package-typescript` `docs/reference/x.md`) is that repository's to resolve.
export const QUALIFIED_BY_REPOSITORY = /`@?[\w.-]+(?:\/[\w.-]+)?`\s+`$/u;

const SKILL_REFERENCE = /^(?<skill>skills\/[^/]+)\/references\/(?<page>[^/]+\.md)$/u;

// invariant: a reference is disclosed step by step, and an agent opens one only where the SKILL.md points to it; a page nothing links is a page no one reads.
export function unlinkedReferences(
    files: readonly string[],
    read: (path: string) => null | string,
): Finding[] {
    return files.flatMap((path) => {
        const { page, skill } = SKILL_REFERENCE.exec(path)?.groups ?? {};
        // Stryker disable next-line LogicalOperator,ConditionalExpression: both groups match together or neither does, so one undefined stands for both
        if (skill === undefined || page === undefined) {
            return [];
        }
        const entry = `${skill}/SKILL.md`;

        // Stryker disable next-line StringLiteral: a SKILL.md that is absent names no page, whatever text stands in for it
        return (read(entry) ?? '').includes(`references/${page}`)
            ? []
            : [
                  {
                      message: `${path} is linked from no line of ${entry}`,
                      path: entry,
                      rule: 'markdown/skill-links-its-references',
                  },
              ];
    });
}
