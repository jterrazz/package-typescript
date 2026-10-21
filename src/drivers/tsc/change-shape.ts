import ts from 'typescript';

import { hunksIn } from '../../../lint/kit/project/diff-hunks.js';
import type { HunkSide } from '../../../lint/kit/project/diff-hunks.js';

/** The lines a change removed and added, each side numbered from 1. */
export type LinesChanged = { added: readonly number[]; removed: readonly number[] };

const linesOf = ({ count, from }: HunkSide): number[] =>
    Array.from({ length: count }, (_, at) => from + at);

/** The lines a `git diff --unified=0` of two texts removes and adds, each side numbered from 1. */
export function linesChangedIn(diff: string): LinesChanged {
    const hunks = hunksIn(diff);

    return {
        added: hunks.flatMap(({ added }) => linesOf(added)),
        removed: hunks.flatMap(({ removed }) => linesOf(removed)),
    };
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

// invariant: per line of a module, from 1, whether a change there reaches only what a function does when it runs: a line of a function, of a type, a comment or a blank. A line is the module's to run as it loads when any token outside a function's own sits on it: `}, 5);` closes a callback and passes a top-level argument on one line, and a change there moves what loading does.
function linesInFunctions(file: string, text: string): (line: number) => boolean {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
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
            if (ts.isTokenKind(child.kind)) {
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

/** Whether every line named of a module, counted from 1, sits in a function, a type, a comment or a blank, so a mutant there changes only what a function does when it runs. */
export function linesStayInFunctions(
    file: string,
    text: string,
    lines: readonly number[],
): boolean {
    const inFunction = linesInFunctions(file, text);

    return lines.every((line) => inFunction(line));
}

/**
 * Whether a change of a module reaches only what its functions do when they run: every line it removed and every line it added sits in a function, a type, a comment or a blank.
 * Such a change moves no test that ran none of the module's functions; any other (a constant, an import, a statement run as the module loads) moves every test that loaded it.
 */
export function changesOnlyFunctions(
    file: string,
    { after, before }: { after: string; before: string },
    { added, removed }: LinesChanged,
): boolean {
    const wasInFunction = linesInFunctions(file, before);
    const isInFunction = linesInFunctions(file, after);

    return (
        removed.every((line) => wasInFunction(line)) && added.every((line) => isInFunction(line))
    );
}

/** Whether a change, as `git diff --unified=0` names its lines between the module's two texts, reaches only what its functions do; a diff that names no line (the earlier text never kept, the module deleted) reads as one that reaches what loading does. */
export function diffStaysInFunctions(
    file: string,
    texts: { after: string; before: () => string },
    diff: string,
): boolean {
    const changed = linesChangedIn(diff);

    return (
        changed.added.length + changed.removed.length > 0 &&
        changesOnlyFunctions(file, { after: texts.after, before: texts.before() }, changed)
    );
}
