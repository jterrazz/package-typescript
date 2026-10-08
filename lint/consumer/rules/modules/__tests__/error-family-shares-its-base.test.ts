import { ruleTester } from '@jterrazz/test';

import { errorFamilySharesItsBase } from '../error-family-shares-its-base.js';

const ERRORS = '/nowhere/src/runtime/errors.ts';

ruleTester().run('error-family-shares-its-base', errorFamilySharesItsBase, {
    invalid: [
        {
            code: [
                'export class RuntimeError extends Error {}',
                'export class Timeout extends RuntimeError {}',
                'export class Ledger {}',
                'export class ParseFailure extends SyntaxError {}',
            ].join('\n'),
            errors: [
                {
                    column: 7,
                    data: { base: 'RuntimeError', name: 'Ledger' },
                    line: 3,
                    messageId: 'outside',
                },
                {
                    column: 7,
                    data: { base: 'RuntimeError', name: 'ParseFailure' },
                    line: 4,
                    messageId: 'outside',
                },
            ],
            filename: ERRORS,
        },
        {
            code: ['export default class extends Error {}', 'export class Ledger {}'].join('\n'),
            errors: [
                { column: 7, data: { base: '', name: 'Ledger' }, line: 2, messageId: 'outside' },
            ],
            filename: '/nowhere/src/session.errors.tsx',
        },
        {
            code: ['export class Base extends Error {}', 'export default class {}'].join('\n'),
            errors: [
                { column: 15, data: { base: 'Base', name: '' }, line: 2, messageId: 'outside' },
            ],
            filename: '/nowhere/src/errors.tsx',
        },
    ],
    valid: [
        {
            code: [
                "import { Failure } from './failure.js';",
                'const CODE = 7;',
                'export class RuntimeError extends Failure {}',
                'export class Timeout extends RuntimeError {}',
                'class Refused extends RuntimeError {}',
                'export class Unreachable extends Refused {}',
                'export default class extends Refused {}',
                'export { Refused as Denied, CODE };',
            ].join('\n'),
            filename: '/nowhere/src/runtime/session.errors.ts',
        },
        {
            code: 'export class Ledger {}\nexport class Shelf {}',
            filename: '/nowhere/src/runtime/ledger.ts',
        },
        {
            code: 'export class Ledger {}\nexport class Shelf {}',
            filename: '/nowhere/src/runtime/myerrors.ts',
        },
    ],
});
