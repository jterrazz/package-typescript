import { defineRule } from '../../../kit/catalogue/rule.js';
import { EVERY_NAME } from '../../../kit/project/importers.js';
import { publishedNamesOf } from '../../../kit/project/published-names.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    body?: Node | Node[];
    declaration?: Node | null;
    declarations?: Node[];
    end?: number;
    exported?: Node;
    id?: Node | null;
    local?: Node;
    name?: string;
    parent?: Node;
    range?: [number, number];
    source?: Node | null;
    specifiers?: Node[];
    start?: number;
    type: string;
    value?: unknown;
};

type Comment = { end?: number; range?: [number, number]; start?: number; value: string };

type SourceCode = { getCommentsBefore: (node: Node) => Comment[]; text: string };

type RuleContext = {
    filename: string;
    physicalFilename?: string;
    report: (report: { data: Record<string, number>; messageId: string; node: Comment }) => void;
    sourceCode: SourceCode;
};

type Declaration = { anchor: Node; name: string | undefined; owner?: Node | null | undefined };

type LineOf = (offset: number) => number;

export const COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME = 'comment-no-longer-than-its-function';

const WHY_FIX = {
    fix: 'say it through the names — rename what needed the comment, and keep at most the one line the code cannot say (an invariant, a hazard, why a value is this one); if documenting context that lives outside the codebase is truly necessary (a policy, a ticket, a decision maker, an external system’s constraint), disable it explicitly on that line — `// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the external context>` — the reason is required',
    why: 'the default is no comment — the code speaks through its names, and a comment longer than the code it sits on restates it, argues it or tells its history',
};

const DIRECTIVE = /^\s*\*?\s*(?:(?:es|ox)lint-(?:disable|enable)|@ts-|biome-ignore)/u;
const FUNCTIONS: ReadonlySet<string> = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);
const EXPORTS: ReadonlySet<string | undefined> = new Set([
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
]);
const MEMBERS: ReadonlySet<string | undefined> = new Set([
    'MethodDefinition',
    'Property',
    'PropertyDefinition',
]);

const startOf = (node: Comment | Node): number => node.range?.[0] ?? node.start ?? 0;
const endOf = (node: Comment | Node): number => node.range?.[1] ?? node.end ?? 0;

function lineIndexOf(text: string): LineOf {
    const starts = [0];
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
        starts.push(index + 1);
    }

    return (offset) => {
        let low = 0;
        let high = starts.length - 1;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if ((starts[middle] ?? 0) <= offset) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }

        return low + 1;
    };
}

const nameOf = (node: Node | undefined): string => String(node?.name ?? node?.value);

const isLocalList = (statement: Node): boolean =>
    statement.type === 'ExportNamedDeclaration' &&
    (statement.source ?? null) === null &&
    (statement.declaration ?? null) === null;

function exportedLocalsOf(program: Node): Map<string, string[]> {
    const exported = new Map<string, string[]>();
    const body = Array.isArray(program.body) ? program.body : [];
    for (const statement of body.filter((candidate) => isLocalList(candidate))) {
        for (const specifier of statement.specifiers ?? []) {
            const local = nameOf(specifier.local);
            exported.set(local, [...(exported.get(local) ?? []), nameOf(specifier.exported)]);
        }
    }

    return exported;
}

function memberOf(fn: Node): Declaration | null {
    const { parent } = fn;
    if (parent === undefined || !MEMBERS.has(parent.type) || parent.value !== fn) {
        return null;
    }
    const owner = parent.parent?.type === 'ClassBody' ? parent.parent.parent : null;

    return { anchor: parent, name: owner?.id?.name, owner };
}

function declarationOf(fn: Node): Declaration | null {
    const { parent } = fn;
    if (parent === undefined) {
        return null;
    }
    if (fn.type === 'FunctionDeclaration') {
        return { anchor: fn, name: fn.id?.name ?? 'default' };
    }
    if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
        const statement = parent.parent;
        return {
            anchor: statement?.declarations?.length === 1 ? statement : parent,
            name: parent.id.name,
        };
    }
    if (parent.type === 'ExportDefaultDeclaration') {
        return { anchor: fn, name: 'default' };
    }

    return memberOf(fn);
}

function isPublished(
    declaration: Declaration,
    exportedLocals: ReadonlyMap<string, readonly string[]>,
    published: ReturnType<typeof publishedNamesOf>,
): boolean {
    if (published === null || declaration.name === undefined) {
        return false;
    }
    const outer = declaration.owner ?? declaration.anchor;
    const direct = EXPORTS.has(outer.parent?.type) || EXPORTS.has(outer.parent?.parent?.type);
    const names = direct
        ? [outer.parent?.type === 'ExportDefaultDeclaration' ? 'default' : declaration.name]
        : (exportedLocals.get(declaration.name) ?? []);

    return names.some((name) => published === EVERY_NAME || published.has(name));
}

function documentingLinesOf(
    anchor: Node,
    sourceCode: SourceCode,
    lineOf: LineOf,
): { first: Comment | null; lines: number } {
    const { text } = sourceCode;
    const lines = new Set<number>();
    let first: Comment | null = null;
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

function bodyLinesOf(body: Node, lineOf: LineOf): number {
    const opening = lineOf(startOf(body));
    const closing = lineOf(endOf(body) - 1);
    if (body.type !== 'BlockStatement') {
        return closing - opening + 1;
    }

    return Math.max(closing - opening - 1, 1);
}

export const commentNoLongerThanItsFunction = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'comments',
            fix: WHY_FIX.fix,
            name: COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME,
            sentence:
                FINDINGS.find(({ id }) =>
                    id.endsWith(`/${COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME}`),
                )?.sentence ?? '',
            why: WHY_FIX.why,
        },
        messages: {
            longer: {
                fix: WHY_FIX.fix,
                found: 'a comment of {{lines}} lines on a function whose body holds {{body}}',
            },
        },
        read: 'docs/08-lint-presets.md#a-comment-no-longer-than-its-function',
        type: 'suggestion',
    },
    {
        create(context: RuleContext): Record<string, (node: Node) => void> {
            const { sourceCode } = context;
            const lineOf = lineIndexOf(sourceCode.text);
            const published = publishedNamesOf(context.physicalFilename ?? context.filename);
            let exportedLocals = new Map<string, string[]>();

            const judge = (fn: Node): void => {
                const { body } = fn;
                if (body === undefined || Array.isArray(body)) {
                    return;
                }
                const declaration = declarationOf(fn);
                if (declaration === null || isPublished(declaration, exportedLocals, published)) {
                    return;
                }
                const anchor =
                    declaration.anchor.parent !== undefined &&
                    EXPORTS.has(declaration.anchor.parent.type)
                        ? declaration.anchor.parent
                        : declaration.anchor;
                const { first, lines } = documentingLinesOf(anchor, sourceCode, lineOf);
                const bodyLines = bodyLinesOf(body, lineOf);
                if (first !== null && lines > Math.max(bodyLines, 1)) {
                    context.report({
                        data: { body: bodyLines, lines },
                        messageId: 'longer',
                        node: first,
                    });
                }
            };

            return {
                Program(program: Node): void {
                    exportedLocals = exportedLocalsOf(program);
                },
                ...Object.fromEntries([...FUNCTIONS].map((type) => [type, judge])),
            };
        },
    },
);
