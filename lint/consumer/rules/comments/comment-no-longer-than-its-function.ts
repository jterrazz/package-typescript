import { defineRule } from '../../../kit/catalogue/rule.js';
import { EVERY_NAME } from '../../../kit/project/importers.js';
import { publishedNamesOf } from '../../../kit/project/published-names.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    declarations?: Node[];
    end: number;
    id?: Node | null;
    name?: string;
    parent?: Node;
    source?: Node | null;
    specifiers?: Specifier[];
    start: number;
    type: string;
    value?: unknown;
};

type Specifier = { exported: Node; local: Node };

type Program = { body: Node[] };

type FunctionNode = Node & { body: Node; parent: Node };

type Comment = { end: number; start: number; value: string };

type SourceCode = { getCommentsBefore: (node: Node) => Comment[]; text: string };

type RuleContext = {
    filename: string;
    report: (report: { data: Record<string, number>; messageId: string; node: Comment }) => void;
    sourceCode: SourceCode;
};

type Binding = { anchor: Node; name: string | undefined; owner?: Node };

type LocalExport = { exported: string; local: string };

type LineOf = (offset: number) => number;

export const COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME = 'comment-no-longer-than-its-function';

const WHY_FIX = {
    fix: "say it through the names: rename what needed the comment, and keep at most the one line the code cannot say (an invariant, a hazard, why a value is this one); if documenting context that lives outside the codebase is truly necessary (a policy, a ticket, a decision maker, an external system's constraint), disable it explicitly on that line with `// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the external context>`, the reason required",
    why: 'the default is no comment: the code speaks through its names, and a comment longer than the code it sits on restates it, argues it or tells its history',
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

        return low;
    };
}

const nameOf = (node: Node): string => String(node.name ?? node.value);

const isLocalList = (statement: Node): boolean =>
    // Stryker disable next-line ConditionalExpression: of the statements carrying specifiers, an import always names its source
    statement.type === 'ExportNamedDeclaration' && statement.source === null;

function localExportsOf(program: Program): LocalExport[] {
    return program.body
        .filter((statement) => isLocalList(statement))
        .flatMap((statement) =>
            (statement.specifiers ?? []).map((specifier) => ({
                exported: nameOf(specifier.exported),
                local: nameOf(specifier.local),
            })),
        );
}

// Stryker disable next-line StringLiteral: an anonymous binding is published only by a default export, which its position names
const ANONYMOUS = 'default';

function memberOf(fn: FunctionNode): Binding | null {
    const { parent } = fn;
    if (parent.value !== fn) {
        return null;
    }
    // Stryker disable next-line OptionalChaining: a method or a property always sits in a body or an object
    const owner = parent.parent?.type === 'ClassBody' ? parent.parent.parent : undefined;

    return owner === undefined
        ? { anchor: parent, name: undefined }
        : { anchor: parent, name: owner.id?.name ?? ANONYMOUS, owner };
}

function bindingOf(fn: FunctionNode): Binding | null {
    const { parent } = fn;
    if (fn.type === 'FunctionDeclaration') {
        return { anchor: fn, name: fn.id?.name ?? ANONYMOUS };
    }
    if (parent.type === 'VariableDeclarator') {
        const statement = parent.parent;
        return {
            // Stryker disable next-line OptionalChaining: a declarator always sits in a declaration, which always lists its declarators
            anchor: statement?.declarations?.length === 1 ? statement : parent,
            // Stryker disable next-line OptionalChaining: a declarator always has an id
            name: parent.id?.name,
        };
    }
    if (parent.type === 'ExportDefaultDeclaration') {
        return { anchor: fn, name: ANONYMOUS };
    }

    return memberOf(fn);
}

function isPublished(
    binding: Binding,
    localExports: readonly LocalExport[],
    published: ReturnType<typeof publishedNamesOf>,
): boolean {
    if (published === null || binding.name === undefined) {
        return false;
    }
    const outer = binding.owner ?? binding.anchor;
    // Stryker disable next-line OptionalChaining: a binding's statement, declarator or member is never the program, so it always has a parent
    const holder = outer.parent?.type;
    // Stryker disable next-line OptionalChaining: a binding's statement, declarator or member is never the program, so it always has a parent
    const grandparent = outer.parent?.parent;
    const direct = EXPORTS.has(holder) || EXPORTS.has(grandparent?.type);
    const names = direct
        ? [holder === 'ExportDefaultDeclaration' ? 'default' : binding.name]
        : localExports
              .filter(({ local }) => local === binding.name)
              .map(({ exported }) => exported);

    return names.some((name) => published === EVERY_NAME || published.has(name));
}

function statementOf(anchor: Node): Node {
    // Stryker disable next-line OptionalChaining: an anchor is never the program, so it always has a parent
    return EXPORTS.has(anchor.parent?.type) ? (anchor.parent ?? anchor) : anchor;
}

function documentingLinesOf(
    anchor: Node,
    sourceCode: SourceCode,
    lineOf: LineOf,
): { first: Comment | null; lines: number } {
    const { text } = sourceCode;
    const lines = new Set<number>();
    let first: Comment | null = null;
    let top = lineOf(anchor.start);
    for (const comment of sourceCode.getCommentsBefore(anchor).toReversed()) {
        const lineStart = text.lastIndexOf('\n', comment.start) + 1;
        if (
            lineOf(comment.end - 1) < top - 1 ||
            text.slice(lineStart, comment.start).trim() !== ''
        ) {
            break;
        }
        top = lineOf(comment.start);
        if (!DIRECTIVE.test(comment.value)) {
            for (let line = top; line <= lineOf(comment.end - 1); line += 1) {
                lines.add(line);
            }
            first = comment;
        }
    }

    return { first, lines: lines.size };
}

function bodyLinesOf(body: Node, lineOf: LineOf): number {
    const opening = lineOf(body.start);
    const closing = lineOf(body.end - 1);
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
        read: 'docs/reference/lint-presets.md#a-comment-no-longer-than-its-function',
        type: 'suggestion',
    },
    {
        create(
            context: RuleContext,
        ): Record<string, ((fn: FunctionNode) => void) | ((program: Program) => void)> {
            const { sourceCode } = context;
            const lineOf = lineIndexOf(sourceCode.text);
            const published = publishedNamesOf(context.filename);
            let localExports: readonly LocalExport[];

            const judge = (fn: FunctionNode): void => {
                const binding = bindingOf(fn);
                if (binding === null || isPublished(binding, localExports, published)) {
                    return;
                }
                const { first, lines } = documentingLinesOf(
                    statementOf(binding.anchor),
                    sourceCode,
                    lineOf,
                );
                const bodyLines = bodyLinesOf(fn.body, lineOf);
                // Stryker disable next-line ConditionalExpression: a line counted means a comment was kept
                if (first !== null && lines > bodyLines) {
                    context.report({
                        data: { body: bodyLines, lines },
                        messageId: 'longer',
                        node: first,
                    });
                }
            };

            return {
                Program(program: Program): void {
                    localExports = localExportsOf(program);
                },
                ...Object.fromEntries([...FUNCTIONS].map((type) => [type, judge])),
            };
        },
    },
);
