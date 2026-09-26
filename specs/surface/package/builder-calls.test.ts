import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

import { packedFiles, packedTree } from './packed-tree.js';

// The module walk sees only what an import builds; a literal audience holds whoever calls the builder, and when.

const CONTRACT = /(?:^|\/)rulebook\/decision\.js$/u;

const BUILDER = 'fragment';

function specifierOf(statement: ts.Statement): string | undefined {
    const specifier =
        ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
            ? statement.moduleSpecifier
            : undefined;
    return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : undefined;
}

function builderNames(named: ts.NamedImportBindings | undefined): string[] {
    return named !== undefined && ts.isNamedImports(named)
        ? named.elements
              .filter((element) => (element.propertyName ?? element.name).text === BUILDER)
              .map((element) => element.name.text)
        : [];
}

function bindings(source: ts.SourceFile): { locals: Set<string>; opaque: string[] } {
    const locals = new Set<string>();
    const opaque: string[] = [];
    for (const statement of source.statements) {
        const specifier = specifierOf(statement) ?? '';
        if (!CONTRACT.test(specifier)) {
            continue;
        }
        if (!ts.isImportDeclaration(statement)) {
            opaque.push(`re-exports from ${specifier}`);
            continue;
        }
        const named = statement.importClause?.namedBindings;
        if (named !== undefined && ts.isNamespaceImport(named)) {
            opaque.push(`imports ${specifier} as a namespace`);
        }
        for (const name of builderNames(named)) {
            locals.add(name);
        }
    }
    return { locals, opaque };
}

function unstated(call: ts.CallExpression): string | undefined {
    const [definition] = call.arguments;
    if (definition === undefined || !ts.isObjectLiteralExpression(definition)) {
        return 'is handed no object literal';
    }
    if (definition.properties.some((property) => ts.isSpreadAssignment(property))) {
        return 'spreads its definition';
    }
    const audience = definition.properties.find(
        (property) => property.name?.getText() === 'audience',
    );
    if (audience === undefined || !ts.isPropertyAssignment(audience)) {
        return 'states no audience';
    }
    return ts.isStringLiteralLike(audience.initializer)
        ? undefined
        : `computes its audience: ${audience.initializer.getText()}`;
}

function unstatedAudiences(tree: string, path: string): string[] {
    const source = ts.createSourceFile(
        path,
        readFileSync(join(tree, path), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
    );
    const { locals, opaque } = bindings(source);
    const found = opaque.map((what) => `${path} ${what}`);
    const visit = (node: ts.Node): void => {
        const { parent } = node;
        if (ts.isIdentifier(node) && locals.has(node.text) && !ts.isImportSpecifier(parent)) {
            const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const why =
                ts.isCallExpression(parent) && parent.expression === node
                    ? unstated(parent)
                    : 'hands the builder on';
            if (why !== undefined) {
                found.push(`${path}:${String(line)} ${why}`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

describe('builder-calls', () => {
    test('every fragment the tarball can build states its audience where it is built', () => {
        // Given - every module the tarball holds
        const tree = packedTree();
        const modules = packedFiles(tree).filter((path) => /\.[cm]?js$/u.test(path));
        expect(modules.length).toBeGreaterThan(50);

        // Then - each call to the fragment builder names its audience as a literal, so no caller and no later turn can compute it
        expect(modules.flatMap((path) => unstatedAudiences(tree, path))).toStrictEqual([]);
    });
});
