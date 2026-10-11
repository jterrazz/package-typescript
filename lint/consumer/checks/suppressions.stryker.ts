import type { Span } from '../../kit/project/comments.js';

export type Placed = { line: number; message: string; rule: string };

const ATTACHES = 'suppressions/stryker-attaches-to-a-mutant';

const NEXT_LINE_DIRECTIVE = /Stryker disable next-line\b/u;

const NEXT_CODE_LINE = /^\s*(?!\/\/|\/\*|\*)\S/u;

// invariant: Stryker attaches a next-line directive to the mutants that START on the next line: a line led by `}` opens none (its block starts above), and a JSX comment container sits between tags where no expression stands.
export function placementOf(
    lines: readonly string[],
    spans: readonly (readonly Span[])[],
): Placed[] {
    const found: Placed[] = [];
    for (const [index, line] of lines.entries()) {
        const comment = (spans[index] ?? []).map(([start, end]) => line.slice(start, end));
        if (!comment.some((one) => NEXT_LINE_DIRECTIVE.test(one))) {
            continue;
        }
        const number = index + 1;
        if (/\{\s*\/\*[\s\S]*?\*\/\s*\}/u.test(line)) {
            found.push({
                line: number,
                message: `line ${number} puts a Stryker directive in a JSX comment container, which Stryker attaches to nothing — write it as a \`//\` line inside the expression container, or wrap the element in a \`// Stryker disable <mutator>: <why>\` … \`// Stryker restore <mutator>\` range`,
                rule: ATTACHES,
            });
            continue;
        }
        const next = lines.slice(index + 1).find((candidate) => NEXT_CODE_LINE.test(candidate));
        if (next?.trimStart().startsWith('}') === true) {
            found.push({
                line: number,
                message: `line ${number} places a Stryker directive above a line led by \`}\`, where no mutant starts — move it to the line of the block's opening, or wrap the block in a \`// Stryker disable <mutator>: <why>\` … \`// Stryker restore <mutator>\` range`,
                rule: ATTACHES,
            });
        }
    }

    return found;
}
