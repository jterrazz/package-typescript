/* oxlint-disable vitest/expect-expect, vitest/valid-describe-callback, vitest/valid-title -- oxlint's RuleTester declares a suite per rule and a test per case, asserting inside each: this file hands it the runner's primitives, so the titles and the assertions are the tester's */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { test as declareCase, describe as declareSuite } from 'vitest';

import { commentNoLongerThanItsFunction } from './comment-no-longer-than-its-function.js';

RuleTester.describe = (name, body) => {
    declareSuite(name, body);
};
RuleTester.it = (name, body) => {
    declareCase(name, body);
};

type OxlintRule = Parameters<RuleTester['run']>[1];

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a JavaScript rule's inferred `meta.type` widens to string, the one field the two shapes disagree on
const rule = commentNoLongerThanItsFunction as OxlintRule;

const ruleTester = new RuleTester();

const PRIVATE_MODULE = '/nowhere/src/ledger.ts';

const library = mkdtempSync(join(tmpdir(), 'comment-rule-'));
mkdirSync(join(library, 'src'));
writeFileSync(
    join(library, 'package.json'),
    JSON.stringify({ exports: { '.': './src/index.ts' }, name: 'library' }),
);
writeFileSync(join(library, 'src/index.ts'), "export { rounded } from './ledger.js';\n");
const PUBLISHED_MODULE = join(library, 'src/ledger.ts');
writeFileSync(PUBLISHED_MODULE, '');

ruleTester.run('comment-no-longer-than-its-function', rule, {
    invalid: [
        {
            code: [
                '/**',
                ' * Doubles a value,',
                ' * by adding it to itself.',
                ' */',
                'function doubled(value: number): number {',
                '    return value + value;',
                '}',
            ].join('\n'),
            errors: [
                {
                    column: 0,
                    data: { body: 1, lines: 4 },
                    endLine: 4,
                    line: 1,
                    messageId: 'longer',
                },
            ],
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                '// Halves a value,',
                '// by dividing it by two.',
                'const halved = (value: number) => value / 2;',
            ].join('\n'),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                'class Ledger {',
                '    // Closes the books,',
                '    // once a month.',
                '    close() {',
                '        this.open = false;',
                '    }',
                '}',
            ].join('\n'),
            errors: [{ column: 4, data: { body: 1, lines: 2 }, line: 2, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                '// Rounds half away from zero,',
                '// as the ledger requires.',
                'function rounded(value: number): number {',
                '    return Math.round(value);',
                '}',
                'export { rounded as round };',
            ].join('\n'),
            errors: [{ data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PUBLISHED_MODULE,
        },
    ],
    valid: [
        {
            code: [
                '// Rounds half away from zero.',
                'function rounded(value: number): number {',
                '    const bounded = Math.abs(value);',
                '    return Math.sign(value) * Math.round(bounded);',
                '}',
            ].join('\n'),
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                '// oxlint-disable-next-line eslint/no-magic-numbers -- FIN-12 sets the ceiling',
                '// @ts-expect-error the ledger is untyped',
                '// The ceiling the finance team fixed.',
                'function capped(value: number): number {',
                '    return Math.min(value, 100);',
                '}',
            ].join('\n'),
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                '// A note on the module,',
                '// two lines long.',
                '',
                'function doubled(value: number): number {',
                '    return value + value;',
                '}',
            ].join('\n'),
            filename: PRIVATE_MODULE,
        },
        {
            code: [
                '/**',
                ' * Rounds half away from zero,',
                ' * as the ledger requires.',
                ' */',
                'export function rounded(value: number): number {',
                '    return Math.round(value);',
                '}',
            ].join('\n'),
            filename: PUBLISHED_MODULE,
        },
        {
            code: [
                '// Rounds half away from zero,',
                '// as the ledger requires.',
                'function rounded(value: number): number {',
                '    return Math.round(value);',
                '}',
                'export { rounded };',
            ].join('\n'),
            filename: PUBLISHED_MODULE,
        },
    ],
});
