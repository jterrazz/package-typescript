import type { Finding, Pass } from '../../engine/checker/pass.js';
import { commentSpansOf, isDirective, SOURCE } from '../../engine/project/comments.js';
import { readText } from '../../engine/project/project-files.js';

const ENTRY = 'comments/comment-lines-held-by-the-baseline';
const GENERATED = /@generated\b/u;
const GENERATED_HEAD_LINES = 5;
const TEST_MARKER = /^\/\/\s*(?:Given|When|Then) - /u;
const READ = 'read: docs/06-quality-checks.md#the-comments-density-pass';

const isProse = (comment: string): boolean => !isDirective(comment) && !TEST_MARKER.test(comment);

export function linesOfComments(text: string): number[] {
    const lines = text.split('\n');
    if (GENERATED.test(lines.slice(0, GENERATED_HEAD_LINES).join('\n'))) {
        return [];
    }
    const spans = commentSpansOf(text);

    return lines.flatMap((line, index) =>
        (spans[index] ?? []).some(([start, end]) => isProse(line.slice(start, end)))
            ? [index + 1]
            : [],
    );
}

function densityOf(count: number, sourceLines: number): string {
    const percent = sourceLines === 0 ? 0 : Math.round((count / sourceLines) * 100);

    return `${count} comment lines — ${percent}% of ${sourceLines} source lines`;
}

function verdictOf(count: number, recorded: number | undefined, density: string): string {
    const why =
        'why: the default is no comment — a name carries the meaning, and the count is held exactly so no comment arrives unseen';
    if (recorded === undefined) {
        return `found: ${density}, and no \`${ENTRY}\` entry records them · ${why} · fix: delete the comments a name can carry, then run 'typescript baseline' to record the count that is left · ${READ}`;
    }
    if (count > recorded) {
        return `found: ${density}, above the ${recorded} recorded · ${why} · fix: delete the comment, or rename what needed it; one that states what the code cannot (an invariant, a hazard, an external system's constraint) is kept by running 'typescript baseline' · ${READ}`;
    }

    return `found: ${density}, below the ${recorded} recorded · ${why}, and slack left in the entry would let one arrive · fix: run 'typescript fix', which re-records the fall · ${READ}`;
}

export const comments: Pass = Object.freeze({
    check(context) {
        let sourceLines = 0;
        const findings: Finding[] = [];
        for (const path of context.files().filter((file) => SOURCE.test(file))) {
            const text = readText(context.root, path);
            if (text !== null) {
                sourceLines += text.split('\n').length;
                findings.push(
                    ...linesOfComments(text).map((line) => ({
                        line,
                        message: 'a comment line',
                        path,
                        rule: ENTRY,
                    })),
                );
            }
        }

        return { findings, sourceLines };
    },
    entry: ENTRY,
    verdict: (count, recorded, { sourceLines }) =>
        verdictOf(count, recorded, densityOf(count, sourceLines ?? 0)),
});
