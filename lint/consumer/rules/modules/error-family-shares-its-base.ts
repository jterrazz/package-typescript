import { basename } from 'node:path';

import { defineRule } from '../../../kit/catalogue/rule.js';
import FINDINGS from '../../catalogue/findings.json' with { type: 'json' };

type Node = {
    declaration?: Node | null;
    end: number;
    id?: null | { name: string };
    name?: string;
    start: number;
    superClass?: Node | null;
    type: string;
};

type Program = { body: Node[] };

type RuleContext = {
    filename: string;
    report: (report: { data: Record<string, string>; messageId: string; node: Node }) => void;
};

export const ERROR_FAMILY_SHARES_ITS_BASE_NAME = 'error-family-shares-its-base';

const ERROR_MODULES = ['errors.ts', 'errors.tsx'];

const WHY_FIX = {
    fix: 'derive the class from the family’s base declared in this module, or move it to a module of its own',
    why: 'an errors module is exempt from max-classes-per-file because its classes are one vocabulary — a base and what derives from it — and a class outside that family is a second subject the cap no longer reads',
};

const classOf = (statement: Node): Node | null => {
    const node = statement.type.startsWith('Export') ? statement.declaration : statement;

    return node?.type === 'ClassDeclaration' ? node : null;
};

export const errorFamilySharesItsBase = defineRule(
    {
        docs: {
            audience: 'consumer',
            family: 'modules',
            fix: WHY_FIX.fix,
            name: ERROR_FAMILY_SHARES_ITS_BASE_NAME,
            sentence: String(
                // Stryker disable next-line OptionalChaining: the catalogue holds the row of every rule the plugin registers, which the self corpus test holds together
                FINDINGS.find(({ id }) => id.endsWith(`/${ERROR_FAMILY_SHARES_ITS_BASE_NAME}`))
                    ?.sentence,
            ),
            why: WHY_FIX.why,
        },
        messages: {
            outside: {
                fix: WHY_FIX.fix,
                found: 'class `{{name}}` derives from no class of this module, beside the base `{{base}}`',
            },
        },
        read: 'docs/reference/lint-presets.md#an-errors-module-holds-one-family',
        type: 'problem',
    },
    {
        create(context: RuleContext): Record<string, (program: Program) => void> {
            const file = basename(context.filename);
            if (!ERROR_MODULES.some((name) => file === name || file.endsWith(`.${name}`))) {
                return {};
            }

            return {
                Program(program: Program): void {
                    const classes = program.body.flatMap((statement) => classOf(statement) ?? []);
                    const declared = new Set(classes.map((node) => node.id?.name));
                    const roots = classes.filter(
                        (node) =>
                            node.superClass?.type !== 'Identifier' ||
                            !declared.has(node.superClass.name),
                    );
                    const [base] = roots;
                    for (const root of roots.slice(1)) {
                        context.report({
                            // Stryker disable next-line OptionalChaining: a second root means a first, so the base is always there
                            data: { base: base?.id?.name ?? '', name: root.id?.name ?? '' },
                            messageId: 'outside',
                            node: root,
                        });
                    }
                },
            };
        },
    },
);
