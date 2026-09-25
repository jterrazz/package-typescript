import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

import { packedFiles, packedTree } from './packed-tree.js';

/*
 * The builder-call rule: every call a module makes to the fragment builder
 * states its audience in the call, as a string literal. A fragment built from
 * such a call has the audience its text shows, whoever calls the builder that
 * holds it and whenever: on import, from a consumer's `layers()`, after a turn.
 * It reads the packed tree, beside the tarball audit, whose module walk sees
 * only what an import builds.
 */

/** The module that exports the fragment builder, as an import names it. */
const CONTRACT = /(?:^|\/)_contract\.js$/u;

/** The builder's exported name. */
const BUILDER = 'fragment';

/** The module a statement imports or re-exports from, or nothing when it names none. */
function specifierOf(statement: ts.Statement): string | undefined {
    const specifier =
        ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
            ? statement.moduleSpecifier
            : undefined;
    return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : undefined;
}

/** The local names an import of the contract binds the builder to. */
function builderNames(named: ts.NamedImportBindings | undefined): string[] {
    return named !== undefined && ts.isNamedImports(named)
        ? named.elements
              .filter((element) => (element.propertyName ?? element.name).text === BUILDER)
              .map((element) => element.name.text)
        : [];
}

/** The names a module binds the builder to, and what it does that no audit can follow. */
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

/** Why a call to the builder does not state its audience as a literal, or nothing when it does. */
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

/** Every place in the JavaScript module `path` of `tree` where the builder is used without a literal audience. */
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

test('every fragment the tarball can build states its audience where it is built', () => {
    // Given - every module the tarball holds
    const tree = packedTree();
    const modules = packedFiles(tree).filter((path) => /\.[cm]?js$/u.test(path));
    expect(modules.length).toBeGreaterThan(50);

    // Then - each call to the fragment builder names its audience as a literal, so no caller and no later turn can compute it
    expect(modules.flatMap((path) => unstatedAudiences(tree, path))).toStrictEqual([]);
});
