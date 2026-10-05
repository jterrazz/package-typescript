import ts from 'typescript';

/** Reads `text` once, and answers for any lines `from` to `to` the last line of every node starting on one of them, or `to` when none ends past it. */
export function lastLineReader(file: string, text: string): (from: number, to: number) => number {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
    const lineAt = (position: number): number =>
        tree.getLineAndCharacterOfPosition(position).line + 1;

    return (from, to) => {
        let last = to;
        const visit = (node: ts.Node): void => {
            // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: a pruning only — a node ending before the lines, and every node within it, starts before them too
            if (lineAt(node.end) < from) {
                return;
            }
            const start = lineAt(node.getStart(tree));
            if (start > to) {
                return;
            }
            if (start >= from) {
                last = Math.max(last, lineAt(node.end));
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(tree, visit);

        return last;
    };
}
