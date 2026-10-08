import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = { declaration?: Node | null; end: number; start: number; type: string };

type Program = { body: Node[] };

type RuleContext = {
    filename: string;
    report: (report: { data: Record<string, string>; messageId: string; node: Node }) => void;
};

export const DATA_MODULE_HOLDS_DATA_NAME = 'data-module-holds-data';

const DATA_SUFFIXES = ['.data.ts', '.data.tsx'];

const WHY_FIX = {
    fix: 'move the logic into a module of its own that imports the table; a `*.data.ts` module keeps its imports, its types and the literals it exports',
    why: 'a data module is exempt from the file-size cap because rows are not logic — a function, a class or a statement in one is logic the cap no longer reads',
};

const DECLARATIONS: ReadonlySet<string> = new Set([
    'ImportDeclaration',
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    'VariableDeclaration',
]);

const LOGIC: ReadonlySet<string> = new Set([
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

function holdsData(statement: Node): boolean {
    if (statement.type === 'ExportNamedDeclaration') {
        return statement.declaration === null || holdsData(statement.declaration ?? statement);
    }

    // invariant: a function or a class is reported where it stands, by its own visitor, never twice.
    return (
        DECLARATIONS.has(statement.type) ||
        LOGIC.has(statement.type) ||
        statement.type === 'ExportDefaultDeclaration'
    );
}

export const dataModuleHoldsData = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'modules',
            fix: WHY_FIX.fix,
            name: DATA_MODULE_HOLDS_DATA_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${DATA_MODULE_HOLDS_DATA_NAME}`))?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            logic: {
                fix: WHY_FIX.fix,
                found: 'a `{{type}}` in a data module',
            },
        },
        read: 'docs/reference/lint-presets.md#a-data-module-holds-data',
        type: 'problem',
    },
    {
        create(context: RuleContext): Record<string, (node: Node & Program) => void> {
            if (!DATA_SUFFIXES.some((suffix) => context.filename.endsWith(suffix))) {
                return {};
            }
            const report = (node: Node): void => {
                context.report({ data: { type: node.type }, messageId: 'logic', node });
            };

            return {
                Program(program: Program): void {
                    for (const statement of program.body.filter((node) => !holdsData(node))) {
                        report(statement);
                    }
                },
                ...Object.fromEntries([...LOGIC].map((type) => [type, report])),
            };
        },
    },
);
