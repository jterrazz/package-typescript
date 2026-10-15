import ts from 'typescript';

// value: past four million cells the table costs more than the run it would spare.
const LARGEST_TABLE = 4_000_000;

function sharedEnds(
    old: readonly string[],
    now: readonly string[],
): { head: number; tail: number } {
    let head = 0;
    while (head < old.length && head < now.length && old[head] === now[head]) {
        head += 1;
    }
    let tail = 0;
    while (
        tail < old.length - head &&
        tail < now.length - head &&
        old[old.length - 1 - tail] === now[now.length - 1 - tail]
    ) {
        tail += 1;
    }

    return { head, tail };
}

function commonTable(
    left: readonly string[],
    right: readonly string[],
): (i: number, j: number) => number {
    const width = right.length + 1;
    const table = new Uint32Array((left.length + 1) * width);
    const at = (i: number, j: number): number => table[i * width + j] ?? 0;
    for (let i = left.length - 1; i >= 0; i -= 1) {
        for (let j = right.length - 1; j >= 0; j -= 1) {
            table[i * width + j] =
                left[i] === right[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
        }
    }

    return at;
}

/** The lines one text holds that the other does not, each side numbered from 1: what a diff of the two would mark removed and added; `undefined` where the pair is too large to diff cheaply. */
export function linesChanged(
    before: string,
    after: string,
): undefined | { added: number[]; removed: number[] } {
    const old = before.split('\n');
    const now = after.split('\n');
    const { head, tail } = sharedEnds(old, now);
    const left = old.slice(head, old.length - tail);
    const right = now.slice(head, now.length - tail);
    if (left.length * right.length > LARGEST_TABLE) {
        return undefined;
    }
    const common = commonTable(left, right);
    const added: number[] = [];
    const removed: number[] = [];
    let i = 0;
    let j = 0;
    while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && left[i] === right[j]) {
            i += 1;
            j += 1;
        } else if (
            j < right.length &&
            (i === left.length || common(i, j + 1) >= common(i + 1, j))
        ) {
            added.push(head + j + 1);
            j += 1;
        } else {
            removed.push(head + i + 1);
            i += 1;
        }
    }

    return { added, removed };
}

const isFunction = (node: ts.Node): boolean =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);

// invariant: a type is erased, so a line of one runs nothing; an import is not, since it rebinds a name the module's own top level may read.
const isErased = (node: ts.Node): boolean =>
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    (ts.isImportDeclaration(node) &&
        node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword) ||
    (ts.isExportDeclaration(node) && node.isTypeOnly);

// invariant: per line of a module, from 1, whether a change there reaches only what a function does when it runs — a line of a function, of a type, a comment or a blank; a line is the module's to run as it loads when any token outside a function's own sits on it — `}, 5);` closes a callback and passes a top-level argument on one line, and a change there moves what loading does.
function linesInFunctions(file: string, text: string): (line: number) => boolean {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const lineOf = (position: number): number =>
        source.getLineAndCharacterOfPosition(position).line + 1;
    const loading = new Set<number>();
    const walk = (node: ts.Node): void => {
        for (const child of node.getChildren(source)) {
            if (
                isFunction(child) ||
                isErased(child) ||
                child.kind === ts.SyntaxKind.EndOfFileToken
            ) {
                continue;
            }
            if (child.kind <= ts.SyntaxKind.LastToken) {
                for (
                    let line = lineOf(child.getStart(source));
                    line <= lineOf(child.end);
                    line += 1
                ) {
                    loading.add(line);
                }
            } else {
                walk(child);
            }
        }
    };
    walk(source);

    return (line) => !loading.has(line);
}

/**
 * Whether a change of a module reaches only what its functions do when they run: every line it removed and every line it added sits in a function, a type, a comment or a blank.
 * Such a change moves no test that ran none of the module's functions; any other — a constant, an import, a statement run as the module loads — moves every test that loaded it.
 */
export function changesOnlyFunctions(file: string, before: string, after: string): boolean {
    const changed = linesChanged(before, after);
    if (changed === undefined) {
        return false;
    }
    const wasInFunction = linesInFunctions(file, before);
    const isInFunction = linesInFunctions(file, after);

    return (
        changed.removed.every((line) => wasInFunction(line)) &&
        changed.added.every((line) => isInFunction(line))
    );
}
