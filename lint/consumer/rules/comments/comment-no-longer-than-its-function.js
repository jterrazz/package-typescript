import { EVERY_NAME } from '../../../engine/project/importers.js';
import { publishedNamesOf } from '../../../engine/project/published-names.js';

export const COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME = 'comment-no-longer-than-its-function';

const DIRECTIVE = /^\s*\*?\s*(?:(?:es|ox)lint-(?:disable|enable)|@ts-|biome-ignore)/u;
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression']);
const EXPORTS = new Set(['ExportDefaultDeclaration', 'ExportNamedDeclaration']);
const MEMBERS = new Set(['MethodDefinition', 'Property', 'PropertyDefinition']);

const startOf = (node) => node.range?.[0] ?? node.start;
const endOf = (node) => node.range?.[1] ?? node.end;

function lineIndexOf(text) {
    const starts = [0];
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
        starts.push(index + 1);
    }

    return (offset) => {
        let low = 0;
        let high = starts.length - 1;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (starts[middle] <= offset) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }

        return low + 1;
    };
}

function exportedLocalsOf(program) {
    const exported = new Map();
    for (const statement of program.body) {
        if (
            statement.type !== 'ExportNamedDeclaration' ||
            statement.source ||
            statement.declaration
        ) {
            continue;
        }
        for (const specifier of statement.specifiers) {
            const local = specifier.local.name ?? specifier.local.value;
            const name = specifier.exported.name ?? specifier.exported.value;
            exported.set(local, [...(exported.get(local) ?? []), name]);
        }
    }

    return exported;
}

function memberOf(fn) {
    const { parent } = fn;
    if (!MEMBERS.has(parent.type) || parent.value !== fn) {
        return null;
    }
    const owner = parent.parent.type === 'ClassBody' ? parent.parent.parent : null;

    return { anchor: parent, name: owner?.id?.name, owner };
}

function declarationOf(fn) {
    const { parent } = fn;
    if (fn.type === 'FunctionDeclaration') {
        return { anchor: fn, name: fn.id?.name ?? 'default' };
    }
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        const statement = parent.parent;
        return {
            anchor: statement.declarations.length === 1 ? statement : parent,
            name: parent.id.name,
        };
    }
    if (parent.type === 'ExportDefaultDeclaration') {
        return { anchor: fn, name: 'default' };
    }

    return memberOf(fn);
}

function isPublished(declaration, exportedLocals, published) {
    if (published === null || declaration.name === undefined) {
        return false;
    }
    const outer = declaration.owner ?? declaration.anchor;
    const direct = EXPORTS.has(outer.parent?.type) || EXPORTS.has(outer.parent?.parent?.type);
    const names = direct
        ? [outer.parent.type === 'ExportDefaultDeclaration' ? 'default' : declaration.name]
        : (exportedLocals.get(declaration.name) ?? []);

    return names.some((name) => published === EVERY_NAME || published.has(name));
}

function documentingLinesOf(anchor, sourceCode, lineOf) {
    const { text } = sourceCode;
    const lines = new Set();
    let first = null;
    let top = lineOf(startOf(anchor));
    for (const comment of sourceCode.getCommentsBefore(anchor).toReversed()) {
        const start = startOf(comment);
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        if (lineOf(endOf(comment) - 1) < top - 1 || text.slice(lineStart, start).trim() !== '') {
            break;
        }
        top = lineOf(start);
        if (!DIRECTIVE.test(comment.value)) {
            for (let line = top; line <= lineOf(endOf(comment) - 1); line += 1) {
                lines.add(line);
            }
            first = comment;
        }
    }

    return { first, lines: lines.size };
}

function bodyLinesOf(body, lineOf) {
    const opening = lineOf(startOf(body));
    const closing = lineOf(endOf(body) - 1);
    if (body.type !== 'BlockStatement') {
        return closing - opening + 1;
    }

    return Math.max(closing - opening - 1, 1);
}

export const commentNoLongerThanItsFunction = {
    create(context) {
        const { sourceCode } = context;
        const lineOf = lineIndexOf(sourceCode.text);
        const published = publishedNamesOf(context.physicalFilename ?? context.filename);
        let exportedLocals = new Map();

        const judge = (fn) => {
            const declaration = fn.body ? declarationOf(fn) : null;
            if (declaration === null || isPublished(declaration, exportedLocals, published)) {
                return;
            }
            const anchor = EXPORTS.has(declaration.anchor.parent?.type)
                ? declaration.anchor.parent
                : declaration.anchor;
            const { first, lines } = documentingLinesOf(anchor, sourceCode, lineOf);
            const body = bodyLinesOf(fn.body, lineOf);
            if (first !== null && lines > Math.max(body, 1)) {
                context.report({ data: { body, lines }, messageId: 'longer', node: first });
            }
        };

        return {
            Program(program) {
                exportedLocals = exportedLocalsOf(program);
            },
            ...Object.fromEntries([...FUNCTIONS].map((type) => [type, judge])),
        };
    },
    meta: {
        messages: {
            longer: [
                'found: a comment of {{lines}} lines on a function whose body holds {{body}}',
                'why: the default is no comment — the code speaks through its names, and a comment longer than the code it sits on restates it, argues it or tells its history',
                'fix: say it through the names — rename what needed the comment, and keep at most the one line the code cannot say (an invariant, a hazard, why a value is this one); if documenting context that lives outside the codebase is truly necessary (a policy, a ticket, a decision maker, an external system’s constraint), disable it explicitly on that line — `// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the external context>` — the reason is required',
                'read: docs/07-lint-presets.md#a-comment-no-longer-than-its-function',
            ].join(' · '),
        },
        type: 'suggestion',
    },
};
