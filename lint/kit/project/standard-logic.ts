import ts from 'typescript';

export const STANDARD_FOLDER = 'src/standard';

export type Logic = { line: number; what: string };

const STANDARD_CALL = 'defineStandard';

const MUTABLE = /^(?:let|var)\b/u;

const UPDATES: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.MinusMinusToken,
    ts.SyntaxKind.PlusPlusToken,
]);

const LOGIC: ReadonlyMap<ts.SyntaxKind, string> = new Map([
    [ts.SyntaxKind.ArrowFunction, 'a function'],
    [ts.SyntaxKind.AwaitExpression, 'an await'],
    [ts.SyntaxKind.ClassDeclaration, 'a class'],
    [ts.SyntaxKind.ClassExpression, 'a class'],
    [ts.SyntaxKind.ConditionalExpression, 'a branch'],
    [ts.SyntaxKind.DoStatement, 'a loop'],
    [ts.SyntaxKind.ForInStatement, 'a loop'],
    [ts.SyntaxKind.ForOfStatement, 'a loop'],
    [ts.SyntaxKind.ForStatement, 'a loop'],
    [ts.SyntaxKind.FunctionDeclaration, 'a function'],
    [ts.SyntaxKind.FunctionExpression, 'a function'],
    [ts.SyntaxKind.GetAccessor, 'a function'],
    [ts.SyntaxKind.IfStatement, 'a branch'],
    [ts.SyntaxKind.MethodDeclaration, 'a function'],
    [ts.SyntaxKind.NewExpression, 'a construction'],
    [ts.SyntaxKind.SetAccessor, 'a function'],
    [ts.SyntaxKind.SwitchStatement, 'a branch'],
    [ts.SyntaxKind.TemplateExpression, 'a computed string'],
    [ts.SyntaxKind.ThrowStatement, 'a throw'],
    [ts.SyntaxKind.TryStatement, 'a try'],
    [ts.SyntaxKind.WhileStatement, 'a loop'],
]);

const isStandardCall = (node: ts.CallExpression): boolean =>
    ts.isIdentifier(node.expression) && node.expression.text === STANDARD_CALL;

// invariant: `String.raw` with nothing interpolated is how a pattern's backslashes are written, not a computation.
const isRawText = (node: ts.TaggedTemplateExpression): boolean =>
    node.tag.getText() === 'String.raw' && ts.isNoSubstitutionTemplateLiteral(node.template);

function operationOf(node: ts.BinaryExpression): string {
    const operator = node.operatorToken.kind;

    return operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment
        ? 'an assignment'
        : 'an operation';
}

const isUpdate = (node: ts.Node): boolean =>
    // Stryker disable next-line ConditionalExpression: only a unary expression carries an operator the updates hold
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    UPDATES.has(node.operator);

function logicOf(node: ts.Node): string | undefined {
    if (ts.isCallExpression(node)) {
        return isStandardCall(node) ? undefined : 'a call';
    }
    if (ts.isTaggedTemplateExpression(node)) {
        return isRawText(node) ? undefined : 'a call';
    }
    if (ts.isBinaryExpression(node)) {
        return operationOf(node);
    }
    if (isUpdate(node)) {
        return 'an assignment';
    }

    return ts.isVariableDeclarationList(node) && MUTABLE.test(node.getText())
        ? 'a variable'
        : LOGIC.get(node.kind);
}

/** What a module of a standard computes instead of stating: a standard is data, and the code applying it lives elsewhere. */
export function logicIn(path: string, text: string): Logic[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const found: Logic[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isTypeNode(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isInterfaceDeclaration(node)
        ) {
            return;
        }
        const what = logicOf(node);
        if (what !== undefined) {
            found.push({
                line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
                what,
            });
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);

    return found;
}
