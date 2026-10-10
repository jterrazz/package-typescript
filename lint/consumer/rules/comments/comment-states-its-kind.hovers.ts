export type AstNode = {
    [key: string]: unknown;
    end: number;
    start: number;
    type: string;
};

const DECLARATIONS: ReadonlySet<string> = new Set([
    'ClassDeclaration',
    'FunctionDeclaration',
    'TSDeclareFunction',
    'TSEnumDeclaration',
    'TSInterfaceDeclaration',
    'TSModuleDeclaration',
    'TSTypeAliasDeclaration',
    'VariableDeclaration',
]);

const MEMBERS: ReadonlySet<string> = new Set([
    'AccessorProperty',
    'MethodDefinition',
    'Property',
    'PropertyDefinition',
    'TSAbstractAccessorProperty',
    'TSAbstractMethodDefinition',
    'TSAbstractPropertyDefinition',
    'TSCallSignatureDeclaration',
    'TSConstructSignatureDeclaration',
    'TSEnumMember',
    'TSIndexSignature',
    'TSMethodSignature',
    'TSPropertySignature',
]);

const FUNCTIONS: ReadonlySet<string> = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

const isNode = (value: unknown): value is AstNode =>
    typeof value === 'object' && value !== null && 'type' in value;

function nodesAt(node: AstNode, key: string): AstNode[] {
    const value = node[key];

    // Stryker disable next-line MethodExpression: a list under the keys read here holds nodes only
    return Array.isArray(value) ? value.filter((item) => isNode(item)) : [];
}

function childrenOf(node: AstNode): AstNode[] {
    return Object.entries(node)
        .filter(([key]) => key !== 'parent')
        .flatMap(([, value]) => [value].flat())
        .filter((value) => isNode(value));
}

function nameOf(node: unknown): string | undefined {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: every name read here is a node's, so the guard only types it
    return isNode(node) && typeof node.name === 'string' ? node.name : undefined;
}

function declaredNamesOf(statement: AstNode): (string | undefined)[] {
    return statement.type === 'VariableDeclaration'
        ? nodesAt(statement, 'declarations').map((declarator) => nameOf(declarator.id))
        : [nameOf(statement.id)];
}

function exportedLocalNamesOf(body: readonly AstNode[]): Set<string | undefined> {
    const names = new Set<string | undefined>();
    for (const statement of body) {
        // Stryker disable next-line ConditionalExpression: of the statements, only an export list states a `source` of null
        if (statement.type === 'ExportNamedDeclaration' && statement.source === null) {
            for (const specifier of nodesAt(statement, 'specifiers')) {
                names.add(nameOf(specifier.local));
            }
        }
        // Stryker disable next-line ConditionalExpression: only a default export holds a bare identifier as its declaration
        if (statement.type === 'ExportDefaultDeclaration') {
            names.add(nameOf(statement.declaration));
        }
    }

    return names;
}

function isExportedByName(statement: AstNode, exported: ReadonlySet<string | undefined>): boolean {
    return (
        statement.type === 'TSExportAssignment' ||
        (statement.type === 'TSModuleDeclaration' && statement.declare === true) ||
        (DECLARATIONS.has(statement.type) &&
            declaredNamesOf(statement).some((name) => name !== undefined && exported.has(name)))
    );
}

function addWithDecorators(targets: Set<number>, node: AstNode): void {
    targets.add(node.start);
    for (const decorator of nodesAt(node, 'decorators')) {
        targets.add(decorator.start);
    }
}

// invariant: a member counts outside a function's body and a class's static block only: what a body holds is no part of what an importer sees.
function addMembers(targets: Set<number>, node: AstNode): void {
    if (MEMBERS.has(node.type)) {
        addWithDecorators(targets, node);
    }
    if (node.type === 'StaticBlock') {
        return;
    }
    const body = FUNCTIONS.has(node.type) ? node.body : undefined;
    for (const child of childrenOf(node).filter((one) => one !== body)) {
        addMembers(targets, child);
    }
}

/** Where a hover may sit: an exported declaration and its members. */
export function hoversOf(program: AstNode): { targets: Set<number> } {
    const targets = new Set<number>();
    const body = nodesAt(program, 'body');
    const exported = exportedLocalNamesOf(body);
    for (const statement of body) {
        const declaration = isNode(statement.declaration) ? statement.declaration : undefined;
        const direct =
            statement.type === 'ExportNamedDeclaration' ||
            statement.type === 'ExportDefaultDeclaration';
        if (direct) {
            targets.add(statement.start);
        }
        const published = direct
            ? declaration
            : isExportedByName(statement, exported)
              ? statement
              : undefined;
        if (published !== undefined) {
            addWithDecorators(targets, published);
            addMembers(targets, published);
        }
    }

    return { targets };
}
