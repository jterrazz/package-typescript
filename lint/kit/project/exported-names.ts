import ts from 'typescript';

type Named = { isFunction: boolean; name: string };

type Binding = Named & { exported: boolean };

type Names = { functions: string[]; values: string[] };

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;

const isFunctionLike = (initializer: ts.Expression | undefined): boolean =>
    initializer !== undefined &&
    (ts.isArrowFunction(initializer) ||
        ts.isFunctionExpression(initializer) ||
        ts.isClassExpression(initializer));

function* bindingsOf(statements: readonly ts.Statement[]): Generator<Binding> {
    for (const statement of statements) {
        const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
        if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
            const name = statement.name?.text;
            // Stryker disable next-line ConditionalExpression: only a default export may go unnamed
            if (name !== undefined && !hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
                yield { exported, isFunction: true, name };
            }
        } else if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name)) {
                    const isFunction = isFunctionLike(declaration.initializer);
                    yield { exported, isFunction, name: declaration.name.text };
                }
            }
        }
    }
}

function* listedOf(statements: readonly ts.Statement[]): Generator<ts.ExportSpecifier> {
    for (const statement of statements) {
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier === undefined) {
            const clause = statement.exportClause;
            // Stryker disable next-line ConditionalExpression,LogicalOperator: an export with no `from` always lists its bindings in braces
            if (clause !== undefined && ts.isNamedExports(clause)) {
                yield* clause.elements;
            }
        }
    }
}

function namesOf(text: string): Names {
    // Stryker disable next-line StringLiteral: the name only picks a script kind, and every kind reads these statements alike
    const { statements } = ts.createSourceFile('module.ts', text, ts.ScriptTarget.Latest);
    const bindings = [...bindingsOf(statements)];
    const declared = new Map(bindings.map(({ isFunction, name }) => [name, isFunction]));
    const listed = [...listedOf(statements)]
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
