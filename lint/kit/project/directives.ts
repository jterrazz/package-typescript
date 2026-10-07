export type Directive = { ids: string[]; line: number; rest: string };

export type SuppressionDirectives = {
    directivesIn: (text: string) => Directive[];
    suppressedLines: (text: string, id: string) => Set<number>;
};

const DIRECTIVE_TEXT = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

export const holdsDirectives = (path: string): boolean => DIRECTIVE_TEXT.test(path);

// invariant: only in a comment: the word inside a string is a test talking about suppressions.
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

// Stryker disable Regex: a reason and a close both run to the end of the line, and a run of separators splits into empty ids the filter drops
const idsOf = (rest: string): string[] =>
    rest
        .replace(/(?:--.*|\*\/\s*)$/u, '')
        .split(/[\s,]+/u)
        .filter((id) => id !== '');
// Stryker restore Regex

const applies = (raw: string, id: string): boolean => {
    const ids = idsOf(raw);

    return ids.includes(id) || ids.includes('*');
};

// invariant: `// <stem>-disable-next-line <id>[,<id>] -- reason` claims the next line of code, stepping over blank lines and other tools' directives; `<stem>-disable-line` claims its own.
export function suppressionDirectives(stem: string): SuppressionDirectives {
    // outside: case-insensitive: the formatter capitalizes a comment's lead.
    const nextLine = new RegExp(`${stem}-disable-next-line\\s+(.*)$`, 'iu');
    const ownLine = new RegExp(`${stem}-disable-line\\s+(.*)$`, 'iu');
    const directive = new RegExp(`(.*?)${stem}-disable(?:-next-line|-line)\\s+(.*)$`, 'iu');

    return {
        directivesIn: (text) =>
            text.split('\n').flatMap((line, index) => {
                const match = directive.exec(line);
                // Stryker disable next-line StringLiteral: no lead reads as no comment, and both groups take part in every match, so a fallback only satisfies the index type
                const [lead, rest] = [match?.[1] ?? '', match?.[2] ?? ''];
                if (!COMMENT_LEAD.test(lead)) {
                    return [];
                }

                return [{ ids: idsOf(rest), line: index + 1, rest }];
            }),
        suppressedLines: (text, id) => {
            const suppressed = new Set<number>();
            const lines = text.split('\n');
            for (const [index, line] of lines.entries()) {
                const next = nextLine.exec(line)?.[1];
                if (next !== undefined && applies(next, id)) {
                    const target = lines.findIndex(
                        (candidate, at) =>
                            at > index &&
                            candidate.trim().length > 0 &&
                            !candidate.trim().startsWith('//'),
                    );
                    if (target !== -1) {
                        suppressed.add(target + 1);
                    }
                }
                const own = ownLine.exec(line)?.[1];
                if (own !== undefined && applies(own, id)) {
                    suppressed.add(index + 1);
                }
            }

            return suppressed;
        },
    };
}
