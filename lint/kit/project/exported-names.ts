import type ts from 'typescript';

import { refusal } from '../catalogue/lesson.js';

type Api = typeof ts;

type Named = { isFunction: boolean; name: string };

type Binding = Named & { exported: boolean };

type Names = { functions: string[]; values: string[] };

let installed: Api | undefined;
try {
    ({ default: installed } = await import('typescript'));
} catch {
    // hazard: the names pass also loads where typescript is not installed; only a lint tree, whose owner installs it, is parsed.
}

function apiOf(): Api {
    // Stryker disable next-line ConditionalExpression: typescript is installed wherever this module's tests run
    if (installed === undefined) {
        throw new Error(
            refusal({
                fix: "run 'npm install' so the typescript @jterrazz/typescript depends on is installed beside it, then run again",
                found: 'the lint tree cannot be read — typescript is not installed',
                read: 'docs/07-quality-checks.md#the-names-tree-pass',
                why: 'what a lint module exports is read from its syntax tree, and typescript parses it',
            }),
        );
    }

    return installed;
}

const hasModifier = (api: Api, node: ts.Node, kind: ts.SyntaxKind): boolean =>
    api.canHaveModifiers(node) &&
    api.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;

const isFunctionLike = (api: Api, initializer: ts.Expression | undefined): boolean =>
    initializer !== undefined &&
    (api.isArrowFunction(initializer) ||
        api.isFunctionExpression(initializer) ||
        api.isClassExpression(initializer));

function* bindingsOf(api: Api, statements: readonly ts.Statement[]): Generator<Binding> {
    for (const statement of statements) {
        const exported = hasModifier(api, statement, api.SyntaxKind.ExportKeyword);
        if (api.isFunctionDeclaration(statement) || api.isClassDeclaration(statement)) {
            const name = statement.name?.text;
            // Stryker disable next-line ConditionalExpression: only a default export may go unnamed
            if (name !== undefined && !hasModifier(api, statement, api.SyntaxKind.DefaultKeyword)) {
                yield { exported, isFunction: true, name };
            }
        } else if (api.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (api.isIdentifier(declaration.name)) {
                    const isFunction = isFunctionLike(api, declaration.initializer);
                    yield { exported, isFunction, name: declaration.name.text };
                }
            }
        }
    }
}

function* listedOf(api: Api, statements: readonly ts.Statement[]): Generator<ts.ExportSpecifier> {
    for (const statement of statements) {
        if (api.isExportDeclaration(statement) && statement.moduleSpecifier === undefined) {
            const clause = statement.exportClause;
            // Stryker disable next-line ConditionalExpression,LogicalOperator: an export with no `from` always lists its bindings in braces
            if (clause !== undefined && api.isNamedExports(clause)) {
                yield* clause.elements;
            }
        }
    }
}

function namesOf(text: string): Names {
    const api = apiOf();
    // Stryker disable next-line StringLiteral: the name only picks a script kind, and every kind reads these statements alike
    const { statements } = api.createSourceFile('module.ts', text, api.ScriptTarget.Latest);
    const bindings = [...bindingsOf(api, statements)];
    const declared = new Map(bindings.map(({ isFunction, name }) => [name, isFunction]));
    const listed = [...listedOf(api, statements)]
        .filter(({ name }) => name.text !== 'default')
        .flatMap(({ name, propertyName }): Named[] => {
            const isFunction = declared.get((propertyName ?? name).text);

            return isFunction === undefined ? [] : [{ isFunction, name: name.text }];
        });
    const exported: Named[] = [...bindings.filter((binding) => binding.exported), ...listed];

    return {
        functions: exported.filter(({ isFunction }) => isFunction).map(({ name }) => name),
        values: exported.filter(({ isFunction }) => !isFunction).map(({ name }) => name),
    };
}

export function exportedFunctions(text: string): string[] {
    return namesOf(text).functions;
}

export function exportedValues(text: string): string[] {
    return namesOf(text).values;
}
