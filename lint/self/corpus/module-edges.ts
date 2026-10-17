import { posix } from 'node:path';
import ts from 'typescript';

import { syntaxWalk } from '../../kit/testing/syntax-walk.js';

export type Edge = { names: readonly string[]; specifier: string; target: string; value: boolean };

export type Imported = Pick<Edge, 'names' | 'value'>;

function importOf(node: ts.ImportDeclaration): Imported {
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    const named = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [];
    const values = named.filter((element) => !element.isTypeOnly);
    const typeOnly =
        clause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
        (clause?.name === undefined && named.length > 0 && values.length === 0);

    return {
        names: values.map((element) => (element.propertyName ?? element.name).text),
        value: !typeOnly,
    };
}

const isRequire = (node: ts.Expression): boolean =>
    (ts.isIdentifier(node) && node.text === 'require') ||
    (ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'createRequire');

// invariant: `require(...)` and `require.resolve(...)` reach a package as an import does, through `createRequire(...)` as well.
const reachesAPackage = (callee: ts.Expression): boolean =>
    callee.kind === ts.SyntaxKind.ImportKeyword ||
    isRequire(callee) ||
    (ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'resolve' &&
        isRequire(callee.expression));

function importedBy(node: ts.Node): [ts.Expression | undefined, Imported] | undefined {
    if (ts.isImportDeclaration(node)) {
        return [node.moduleSpecifier, importOf(node)];
    }
    if (ts.isExportDeclaration(node)) {
        return [node.moduleSpecifier, { names: [], value: !node.isTypeOnly }];
    }

    return ts.isCallExpression(node) && reachesAPackage(node.expression)
        ? [node.arguments[0], { names: [], value: true }]
        : undefined;
}

export function moduleEdges(module: string, source: ts.SourceFile): Edge[] {
    const edges: Edge[] = [];
    syntaxWalk(source, (node) => {
        const [specifier, imported] = importedBy(node) ?? [];
        if (specifier !== undefined && imported !== undefined && ts.isStringLiteral(specifier)) {
            const { text } = specifier;
            const target = text.startsWith('.')
                ? posix.join(posix.dirname(module), text).replace(/\.js$/u, '.ts')
                : text;
            edges.push({ ...imported, specifier: text, target });
        }
    });

    return edges;
}
