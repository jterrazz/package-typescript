import ts from 'typescript';

/** Visits `node` and every node beneath it, parents first. */
export function syntaxWalk(node: ts.Node, visit: (node: ts.Node) => void): void {
    visit(node);
    ts.forEachChild(node, (child) => {
        syntaxWalk(child, visit);
    });
}
