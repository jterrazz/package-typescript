import { ruleTester } from '@jterrazz/test';

import { dataModuleHoldsData } from '../data-module-holds-data.js';

const DATA = '/nowhere/src/catalogue/projects.data.ts';

ruleTester().run('data-module-holds-data', dataModuleHoldsData, {
    invalid: [
        {
            code: [
                "import type { Project } from './project.js';",
                "export const PROJECTS: readonly Project[] = [{ slug: 'atlas' }];",
                'export function projectNamed(slug: string) {',
                '    return PROJECTS.find((project) => project.slug === slug);',
                '}',
            ].join('\n'),
            errors: [
                { column: 7, data: { type: 'FunctionDeclaration' }, line: 3, messageId: 'logic' },
                {
                    column: 25,
                    data: { type: 'ArrowFunctionExpression' },
                    line: 4,
                    messageId: 'logic',
                },
            ],
            filename: DATA,
        },
        {
            code: [
                "export const ROWS = [{ label: 'a', render: () => 'A' }];",
                'class Registry {}',
                'ROWS.sort();',
                'export default Registry;',
            ].join('\n'),
            errors: [
                {
                    column: 43,
                    data: { type: 'ArrowFunctionExpression' },
                    line: 1,
                    messageId: 'logic',
                },
                { column: 0, data: { type: 'ClassDeclaration' }, line: 2, messageId: 'logic' },
                { column: 0, data: { type: 'ExpressionStatement' }, line: 3, messageId: 'logic' },
            ],
            filename: '/nowhere/src/rows.data.tsx',
        },
        {
            code: ['export namespace Rows {}', "export { CATEGORY } from './category.js';"].join(
                '\n',
            ),
            errors: [
                {
                    column: 0,
                    data: { type: 'ExportNamedDeclaration' },
                    line: 1,
                    messageId: 'logic',
                },
            ],
            filename: DATA,
        },
    ],
    valid: [
        {
            code: [
                "import type { Project } from './project.js';",
                "import { CATEGORY } from './category.js';",
                'type Row = { name: string };',
                'interface Shelf { rows: Row[] }',
                'const SHARED = { category: CATEGORY.tools } as const;',
                "export const PROJECTS: readonly Project[] = [{ ...SHARED, slug: 'atlas' }];",
                'export type { Shelf };',
                "export default { rows: [{ name: 'a' }] } satisfies Shelf;",
            ].join('\n'),
            filename: DATA,
        },
        {
            code: 'export function projectNamed(slug: string) { return slug; }',
            filename: '/nowhere/src/catalogue/projects.ts',
        },
        {
            code: 'export function projectNamed(slug: string) { return slug; }',
            filename: '/nowhere/src/catalogue/projects.data.ts.snap.ts',
        },
    ],
});
