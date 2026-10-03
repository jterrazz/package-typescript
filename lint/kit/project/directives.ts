export type Directive = { ids: string[]; line: number; rest: string };

export type SuppressionDirectives = {
    directivesIn: (text: string) => Directive[];
    suppressedLines: (text: string, id: string) => Set<number>;
};

const DIRECTIVE_TEXT = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

export const holdsDirectives = (path: string): boolean => DIRECTIVE_TEXT.test(path);

// Only in a comment: the word inside a string is a test talking about suppressions.
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

const idsOf = (rest: string): string[] =>
    rest
        .replace(/--.*$/u, '')
        .trim()
        .split(/[\s,]+/u)
        .filter((id) => id !== '');

const applies = (raw: string, id: string): boolean => {
    const ids = idsOf(raw);

    return ids.includes(id) || ids.includes('*');
};

// `// <stem>-disable-next-line <id>[,<id>] -- reason` claims the next line of code, stepping over blank lines and other tools' directives; `<stem>-disable-line` claims its own.
export function suppressionDirectives(stem: string): SuppressionDirectives {
    // Case-insensitive: the formatter capitalizes a comment's lead.
    const nextLine = new RegExp(`${stem}-disable-next-line\\s+(?<ids>.*)$`, 'iu');
    const ownLine = new RegExp(`${stem}-disable-line\\s+(?<ids>.*)$`, 'iu');
    const directive = new RegExp(
        `(?<lead>.*?)${stem}-disable(?:-next-line|-line)\\s+(?<rest>.*)$`,
        'iu',
    );

    return {
        directivesIn: (text) =>
            text.split('\n').flatMap((line, index) => {
                const match = directive.exec(line);
                if (match === null || !COMMENT_LEAD.test(match.groups?.lead ?? '')) {
                    return [];
                }
                const rest = match.groups?.rest ?? '';

                return [{ ids: idsOf(rest), line: index + 1, rest }];
            }),
        suppressedLines: (text, id) => {
            const suppressed = new Set<number>();
            const lines = text.split('\n');
            for (const [index, line] of lines.entries()) {
                const next = nextLine.exec(line);
                if (next !== null && applies(next.groups?.ids ?? '', id)) {
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
                const own = ownLine.exec(line);
                if (own !== null && applies(own.groups?.ids ?? '', id)) {
                    suppressed.add(index + 1);
                }
            }

            return suppressed;
        },
    };
}
