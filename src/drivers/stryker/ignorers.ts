export const LOG_IGNORER = 'typescript-logs';

export const LOG_REASON = 'a diagnostic log call: what it writes is no behaviour a test owes';

// invariant: a statement that only calls a logger is never mutated, the call nor the statement around it: Stryker's CallExpression mutator removes the statement, so the ignorer matches the statement, which holds every mutant of the call. A receiver is a logger when it is `console`, or is named `log` or `logger` or ends in `Logger`, and the method a log level.
export const IGNORERS_SOURCE = `const LEVELS = new Set(['debug', 'error', 'fatal', 'info', 'log', 'trace', 'warn', 'warning']);

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

export const strykerPlugins = [{ kind: 'Ignore', name: '${LOG_IGNORER}', value: logs }];
`;
