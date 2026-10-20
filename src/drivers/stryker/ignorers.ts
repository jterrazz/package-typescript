export const LOG_IGNORER = 'typescript-logs';

export const LOG_REASON = 'a diagnostic log call: what it writes is no behaviour a test owes';

export const PINNED_TEXT_IGNORER = 'typescript-pinned-text';

export const PINNED_TEXT_REASON =
    'text a presentation file prints: the golden its declaration names pins it whole';

const COMPARED = new Set(['!=', '!==', '==', '===']);

// invariant: a statement that only calls a logger is never mutated, the call nor the statement around it: Stryker's CallExpression mutator removes the statement, so the ignorer matches the statement, which holds every mutant of the call. A receiver is a logger when it is `console`, or is named `log` or `logger` or ends in `Logger`, and the method a log level.
const LOGS_SOURCE = `const LEVELS = new Set(['debug', 'error', 'fatal', 'info', 'log', 'trace', 'warn', 'warning']);

const LOGGER = /^(?:log|logger|.*Logger)$/u;

const nameOf = (node) => {
    if (node.type === 'Identifier') {
        return node.name;
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
        return node.property.name;
    }
    if (node.type === 'ThisExpression') {
        return 'this';
    }
    return undefined;
};

const isLogCall = (node) => {
    const call = node.type === 'AwaitExpression' ? node.argument : node;
    if (call.type !== 'CallExpression' || call.callee.type !== 'MemberExpression' || call.callee.computed) {
        return false;
    }
    const receiver = nameOf(call.callee.object);
    const method = call.callee.property.type === 'Identifier' ? call.callee.property.name : undefined;

    return receiver === 'console' || (receiver !== undefined && LOGGER.test(receiver) && LEVELS.has(method));
};

const logs = {
    shouldIgnore(path) {
        return path.isExpressionStatement() && isLogCall(path.node.expression) ? ${JSON.stringify(LOG_REASON)} : undefined;
    },
};
`;

// invariant: in a file a `typescript.mutation.presentation` glob names, a string literal and a template literal with no expression are never mutated, unless the string decides: compared, a `switch` case, a computed key, or a module's source. Stryker runs from the project's root, so a file's path is read relative to it.
const PINNED_TEXT_SOURCE = `const COMPARED = new Set(${JSON.stringify([...COMPARED])});

const isText = ({ node }) =>
    node.type === 'StringLiteral' || (node.type === 'TemplateLiteral' && node.expressions.length === 0);

const decides = ({ key, parent }) =>
    (parent.type === 'BinaryExpression' && COMPARED.has(parent.operator)) ||
    (parent.type === 'SwitchCase' && key === 'test') ||
    ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && parent.computed && key === 'property') ||
    ((parent.type === 'ObjectProperty' || parent.type === 'ClassProperty') && parent.computed && key === 'key') ||
    (key === 'source' && ['ExportAllDeclaration', 'ExportNamedDeclaration', 'ImportDeclaration'].includes(parent.type)) ||
    parent.type === 'ImportExpression' ||
    (parent.type === 'CallExpression' && parent.callee.type === 'Import');

const presented = (filename) => {
    const file = relative(process.cwd(), String(filename)).replaceAll('\\\\', '/');

    return PRESENTATION.some((glob) => matchesGlob(file, glob));
};

const pinnedText = {
    shouldIgnore(path) {
        return PRESENTATION.length > 0 && isText(path) && !decides(path) && presented(path.hub?.file?.opts?.filename)
            ? ${JSON.stringify(PINNED_TEXT_REASON)}
            : undefined;
    },
};
`;

export function ignorersSource(presentation: readonly string[]): string {
    return `import { matchesGlob, relative } from 'node:path';

const PRESENTATION = ${JSON.stringify(presentation)};

${LOGS_SOURCE}
${PINNED_TEXT_SOURCE}
export const strykerPlugins = [
    { kind: 'Ignore', name: '${LOG_IGNORER}', value: logs },
    { kind: 'Ignore', name: '${PINNED_TEXT_IGNORER}', value: pinnedText },
];
`;
}
