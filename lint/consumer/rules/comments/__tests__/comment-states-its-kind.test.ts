import { ruleTester } from '@jterrazz/test';

import { commentStatesItsKind } from '../comment-states-its-kind.js';

const lines = (...text: string[]): string => text.join('\n');

ruleTester().run('comment-states-its-kind', commentStatesItsKind, {
    invalid: [
        {
            code: lines("test('adds', () => {", '    // Given - two numbers', '});'),
            errors: [{ column: 4, line: 2, messageId: 'unstated' }],
        },
        {
            code: lines('// adds the two values', 'const sum = 1 + 2;'),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines('const sum = 1 + 2; // the sum'),
            errors: [{ column: 19, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines(
                '/**',
                ' * Doubles a value.',
                ' */',
                'export const doubled = (value) => value * 2;',
            ),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines(
                '// hazard: the first run states its kind',
                'const one = 1;',
                '// the second, apart from it, does not',
                'const two = 2;',
            ),
            errors: [{ column: 0, line: 3, messageId: 'unstated' }],
        },
        {
            code: lines('/* a block of prose */', 'const one = 1;'),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines('// Invariant: the kind is lower case', 'const one = 1;'),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines('//* a line comment dressed as a hover', 'const one = 1;'),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines(
                '/** Sum. */ export const sum = 1;',
                'export const end = 2; /** Trailing. */',
            ),
            errors: [
                { column: 0, line: 1, messageId: 'unstated' },
                { column: 22, line: 2, messageId: 'unstated' },
            ],
        },
        {
            code: lines('/* hazard: a block opens the run */', '// a line after it starts its own'),
            errors: [{ column: 0, line: 2, messageId: 'unstated' }],
        },
        {
            code: lines('// hazard: a line opens the run', '/* a block after it starts its own */'),
            errors: [{ column: 0, line: 2, messageId: 'unstated' }],
        },
        {
            code: lines('// value/: a slash is no part of the kind', 'const one = 1;'),
            errors: [{ column: 0, line: 1, messageId: 'unstated' }],
        },
        {
            code: lines(
                '',
                '',
                '',
                '',
                '',
                '// @generated below the head is no marker',
                'export {};',
            ),
            errors: [{ column: 0, line: 6, messageId: 'unstated' }],
        },
        {
            code: lines(
                '// Stryker disable next-line CallExpression: outside: a kind after the mutator',
                'const a = 1;',
                '// oxlint-disable-next-line no-console -- hazard: a kind after the rule',
                'console.log(a);',
            ),
            errors: [
                { column: 0, line: 1, messageId: 'kindedInstruction' },
                { column: 0, line: 3, messageId: 'kindedInstruction' },
            ],
        },
    ],
    valid: [
        lines('#!/usr/bin/env node', '// hazard: the shebang is no comment', 'run();'),
        lines('/** The sum of two values. */   ', 'export const sum = (a, b) => a + b;'),
        lines(
            'function drain() {',
            '    // invariant: an indented run,',
            '    // carried on by its second line',
            '}',
        ),
        lines('// hazard: a run read across a Windows line break,\r', '// still one run'),
        lines('///  <reference types="vite/client" />', 'export {};'),
        lines(
            '// invariant: the queue is drained before the next tick,',
            '// so a reader never sees half a batch',
            'const drained = [];',
        ),
        lines('// hazard: the vendor API answers 200 on a refusal', 'const ok = 200;'),
        lines('// outside: the registry keeps a name 72 hours', 'const hours = 72;'),
        lines('const width = 100; // value: the print width every repository is written at'),
        lines('/** The sum of two values. */', 'export const sum = (a, b) => a + b;'),
        lines(
            '/**',
            ' * invariant: an id is never reused,',
            ' * even after its row is deleted',
            ' */',
            'let next = 0;',
        ),
        lines('// oxlint-disable-next-line no-console -- the CLI prints', 'console.log(1);'),
        lines('// @ts-expect-error -- the fixture is wrong on purpose', 'const n = 1;'),
        lines('// oxfmt-ignore', 'const matrix = [1,0,0,1];'),
        lines('/* v8 ignore next */', 'if (process.env.CI) {}'),
        lines('// Stryker disable next-line all: an equivalent mutant', 'const a = 1;'),
        lines('const lazy = /* @__PURE__ */ make();'),
        lines('/// <reference types="vite/client" />', 'export {};'),
        {
            code: lines(
                "test('adds', () => {",
                '    // Given - two numbers',
                '    // When - they are added',
                '    // Then - the sum is theirs',
                '});',
            ),
            options: [{ openings: ['Given - ', 'When - ', 'Then - '] }],
        },
        lines('// @generated by the schema compiler', '// a line', 'export {};'),
        {
            code: lines('// testId: the widget renders no accessible name', 'const id = 1;'),
            options: [{ openings: ['testId:'] }],
        },
    ],
});
