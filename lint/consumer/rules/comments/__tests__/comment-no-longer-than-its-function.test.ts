import { ruleTester } from '@jterrazz/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { commentNoLongerThanItsFunction } from '../comment-no-longer-than-its-function.js';

const PRIVATE_MODULE = '/nowhere/src/ledger.ts';

const lines = (...text: string[]): string => text.join('\n');

const TWO_LINES = ['// Says it twice,', '// in two lines.'];

const library = mkdtempSync(join(tmpdir(), 'comment-rule-'));
mkdirSync(join(library, 'src'));
writeFileSync(
    join(library, 'package.json'),
    JSON.stringify({ exports: { '.': './src/index.ts' }, name: 'library' }),
);
const ENTRY = join(library, 'src/index.ts');
writeFileSync(ENTRY, "export { default, rounded } from './ledger.js';\n");
const PUBLISHED_MODULE = join(library, 'src/ledger.ts');
writeFileSync(PUBLISHED_MODULE, '');

ruleTester().run('comment-no-longer-than-its-function', commentNoLongerThanItsFunction, {
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
            errors: [
                {
                    column: 0,
                    line: 1,
                    message:
                        "found: a comment of 2 lines on a function whose body holds 1 · why: the default is no comment: the code speaks through its names, and a comment longer than the code it sits on restates it, argues it or tells its history · fix: say it through the names: rename what needed the comment, and keep at most the one line the code cannot say (an invariant, a hazard, why a value is this one); if documenting context that lives outside the codebase is truly necessary (a policy, a ticket, a decision maker, an external system's constraint), disable it explicitly on that line with `// oxlint-disable-next-line jterrazz-typescript/comment-no-longer-than-its-function -- <the external context>`, the reason required · read: docs/reference/lint-presets.md#a-comment-no-longer-than-its-function",
                },
            ],
            filename: PRIVATE_MODULE,
        },
        {
            name: 'A tool name in the middle of a sentence is prose, and counts.',
            code: [
                '// Halves a value,',
                '// see eslint-disable for the reason.',
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
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PUBLISHED_MODULE,
        },
        {
            code: lines(
                ...TWO_LINES,
                'export function doubled(value) {',
                '    return value + value;',
                '}',
            ),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(...TWO_LINES, 'function one() { return 1; }'),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(...TWO_LINES, 'export default () => {', '    return 1;', '};'),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(...TWO_LINES, 'export default function () {', '    return 1;', '}'),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(
                'const one = 1,',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    halved = (value) => value / 2;',
            ),
            errors: [{ column: 4, data: { body: 1, lines: 2 }, line: 2, messageId: 'longer' }],
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(
                ...TWO_LINES,
                'function rounded(value) {',
                '    return value;',
                '}',
                "export { rounded } from './elsewhere.js';",
            ),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PUBLISHED_MODULE,
        },
        {
            code: lines(
                'export const api = {',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    run() {',
                '        return 1;',
                '    },',
                '};',
            ),
            errors: [{ column: 4, data: { body: 1, lines: 2 }, line: 2, messageId: 'longer' }],
            filename: ENTRY,
        },
        {
            code: lines(
                'export default {',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    run() {',
                '        return 1;',
                '    },',
                '};',
            ),
            errors: [{ column: 4, data: { body: 1, lines: 2 }, line: 2, messageId: 'longer' }],
            filename: ENTRY,
        },
        {
            code: lines(...TWO_LINES, 'export function hidden() {', '    return 1;', '}'),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 1, messageId: 'longer' }],
            filename: PUBLISHED_MODULE,
        },
        {
            code: lines(
                'const base = 1;',
                ...TWO_LINES,
                'function helper() {',
                '    return base;',
                '}',
                'function rounded() {',
                '    return helper();',
                '}',
                'export { rounded };',
            ),
            errors: [{ column: 0, data: { body: 1, lines: 2 }, line: 2, messageId: 'longer' }],
            filename: PUBLISHED_MODULE,
        },
    ],
    valid: [
        {
            name: 'A directive in a block opened by a star is a directive, and counts for nothing.',
            code: [
                '/** @ts-expect-error the value arrives untyped */',
                '// Halves a value.',
                'const halved = (value: number) => value / 2;',
            ].join('\n'),
            filename: PRIVATE_MODULE,
        },
        {
            name: 'A directive written flush against its slashes is a directive, and counts for nothing.',
            code: [
                '//eslint-disable-next-line no-console',
                '// Halves a value.',
                'const halved = (value: number) => value / 2;',
            ].join('\n'),
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(
                ...TWO_LINES,
                '// and a third.',
                'items.forEach((item) => {',
                '    use(item);',
                '});',
            ),
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(
                'const base = 1; // a note on the line above',
                '// One line.',
                'function based() {',
                '    return base;',
                '}',
            ),
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(...TWO_LINES, 'const sum = (a, b) =>', '    a +', '    b;'),
            filename: PRIVATE_MODULE,
        },
        {
            code: lines(
                'export default class {',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    run() {',
                '        return 1;',
                '    }',
                '}',
            ),
            filename: ENTRY,
        },
        {
            code: lines(
                'export class Ledger {',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    close() {',
                '        return 1;',
                '    }',
                '}',
            ),
            filename: ENTRY,
        },
        {
            code: lines(
                "import { round } from './math.js';",
                ...TWO_LINES,
                'function rounded(value) {',
                '    return round(value);',
                '}',
                'export { rounded, rounded as round };',
            ),
            filename: PUBLISHED_MODULE,
        },
        {
            code: lines(...TWO_LINES, 'export default function rounding() {', '    return 1;', '}'),
            filename: PUBLISHED_MODULE,
        },
        {
            code: lines(
                'export const one = 1,',
                ...TWO_LINES.map((line) => `    ${line}`),
                '    rounded = (value) => Math.round(value);',
            ),
            filename: PUBLISHED_MODULE,
        },
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
