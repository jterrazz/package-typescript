const FENCE_RUN_LIMIT = 15;

const FRONTMATTER = /^---\n.*?\n---\n/su;

export const FENCE = /^\s*(?:```|~~~)/u;

export function linesWithFrontmatterBlanked(markdown: string): string[] {
    return markdown.replace(FRONTMATTER, (block) => block.replaceAll(/[^\n]/gu, '')).split('\n');
}

type FenceLine = { line: number; text: string };

const OPENS_A_BLOCK = /[([{]\s*$/u;

const CLOSES_A_BLOCK = /^\s*[)\]}]/u;

// invariant: the formatter drops a blank line that follows an opener or precedes a closer inside a fenced code block and keeps every other one; the break named is the middle one of those that stay.
function survivingBreak(run: readonly FenceLine[]): number | undefined {
    const middle = run.length / 2;
    let best: number | undefined;
    for (const [index, { text }] of run.entries()) {
        const next = run[index + 1];
        if (next === undefined || OPENS_A_BLOCK.test(text) || CLOSES_A_BLOCK.test(next.text)) {
            continue;
        }
        if (best === undefined || Math.abs(index + 1 - middle) < Math.abs(best - middle)) {
            best = index + 1;
        }
    }

    // Stryker disable next-line ConditionalExpression,OptionalChaining: a break found is always the index of a line that has a next one, and with none found the index read is NaN, which no line holds
    return best === undefined ? undefined : run[best - 1]?.line;
}

export function airlessFences(markdown: string): string[] {
    let inFence = false;
    let fenceStart = 0;
    // Stryker disable next-line ArrayDeclaration: the first fence opening empties the run before any line joins it, so what it starts with is never counted
    let run: FenceLine[] = [];
    const found: string[] = [];
    const close = (): void => {
        if (run.length > FENCE_RUN_LIMIT) {
            const at = survivingBreak(run);
            found.push(
                `a fenced block at line ${fenceStart} runs ${run.length} lines unbroken, over the limit of ${FENCE_RUN_LIMIT}${at === undefined ? '' : `; a blank line after line ${at} survives the formatter`}`,
            );
        }
        run = [];
    };

    for (const [index, line] of linesWithFrontmatterBlanked(markdown).entries()) {
        if (FENCE.test(line)) {
            if (inFence) {
                close();
            } else {
                fenceStart = index + 1;
                run = [];
            }
            inFence = !inFence;
            continue;
        }
        if (!inFence) {
            continue;
        }
        if (line.trim() === '') {
            close();
            continue;
        }
        run.push({ line: index + 1, text: line });
    }
    close();

    return found;
}
