import { ruleTester } from '@jterrazz/test';

import { hoversOf } from '../comment-states-its-kind.hovers.js';
import type { AstNode } from '../comment-states-its-kind.hovers.js';

type Located = { end: number; range: readonly [number, number]; start: number };

type ProbeContext = {
    report: (report: { messageId: string; node: Located }) => void;
};

const lines = (...text: string[]): string => text.join('\n');

// invariant: a probe reports each offset hoversOf hands back, so a case reads as the places a hover may sit and the empty containers.
const probe = {
    create(context: ProbeContext): Record<string, (program: AstNode) => void> {
        return {
            Program(program: AstNode): void {
                const { empties, targets } = hoversOf(program);
                for (const target of [...targets].toSorted((left, right) => left - right)) {
                    context.report({
                        messageId: 'target',
                        node: { end: target + 1, range: [target, target + 1], start: target },
                    });
                }
                for (const [start, end] of empties) {
                    context.report({
                        messageId: 'empty',
                        node: { end, range: [start, end], start },
                    });
                }
            },
        };
    },
    meta: { messages: { empty: 'empty', target: 'target' }, type: 'problem' },
};

const at = (
    line: number,
    column: number,
    messageId = 'target',
): { column: number; line: number; messageId: string } => ({
    column,
    line,
    messageId,
});

ruleTester().run('comment-states-its-kind.hovers', probe, {
    invalid: [
        {
            code: lines(
                'export const one = 1;',
                'export default function two() {}',
                'export { three };',
                'const three = 3;',
                "export { five } from './five.js';",
            ),
            errors: [at(1, 0), at(1, 7), at(2, 0), at(2, 15), at(3, 0), at(4, 0), at(5, 0)],
        },
        {
            code: lines(
                "export { five } from './five.js';",
                'const five = 5;',
                'const six = 6, seven = 7;',
                'export { seven };',
                'const eight = 8;',
            ),
            errors: [at(1, 0), at(3, 0), at(4, 0)],
        },
        {
            code: lines('export default 42;', 'const { nine } = TEN;'),
            errors: [at(1, 0), at(1, 15)],
        },
        {
            code: lines('@sealed', 'export class Sealed {', '    @tracked', '    value = 1;', '}'),
            errors: [at(1, 0), at(2, 0), at(2, 7), at(3, 4)],
            filename: 'sealed.ts',
        },
        {
            code: lines('declare const a: number;', 'namespace N { const b = 1; }', 'export {};'),
            errors: [at(3, 0)],
            filename: 'ambient.ts',
        },
        {
            code: lines('function four() {}', 'export default four;'),
            errors: [at(1, 0), at(2, 0), at(2, 15)],
        },
        {
            code: lines(
                'export class Ledger {',
                '    entries = [];',
                '    add(entry) {',
                '        const inner = { kept: entry };',
                '    }',
                '}',
            ),
            errors: [at(1, 0), at(1, 7), at(2, 4), at(3, 4)],
        },
        {
            code: lines(
                'export interface Port { read(): string; size: number }',
                'export enum Tone { Loud }',
                'export type Shape = { side: number };',
            ),
            filename: 'port.ts',
            errors: [
                at(1, 0),
                at(1, 7),
                at(1, 24),
                at(1, 40),
                at(2, 0),
                at(2, 7),
                at(2, 19),
                at(3, 0),
                at(3, 7),
                at(3, 22),
            ],
        },
        {
            code: lines(
                'class Alpha {}',
                'function beta() {}',
                'declare function gamma(): void;',
                'enum Delta { One }',
                'interface Epsilon {}',
                'namespace Zeta {}',
                'type Eta = number;',
                'var theta = 1;',
                'export { Alpha, beta, gamma, Delta, Epsilon, Zeta, Eta, theta };',
            ),
            errors: [
                at(1, 0),
                at(2, 0),
                at(3, 0),
                at(4, 0),
                at(4, 13),
                at(5, 0),
                at(6, 0),
                at(7, 0),
                at(8, 0),
                at(9, 0),
            ],
            filename: 'declared.ts',
        },
        {
            code: lines(
                'export abstract class Shape {',
                '    abstract sides: number;',
                '    abstract area(): number;',
                '    abstract accessor name: string;',
                '    accessor colour = "red";',
                '    static {',
                '        const inner = { kept: 1 };',
                '    }',
                '}',
                'export interface Callable {',
                '    (input: string): number;',
                '    new (input: string): Callable;',
                '    [key: string]: unknown;',
                '}',
            ),
            errors: [
                at(1, 0),
                at(1, 7),
                at(2, 4),
                at(3, 4),
                at(4, 4),
                at(5, 4),
                at(10, 0),
                at(10, 7),
                at(11, 4),
                at(12, 4),
                at(13, 4),
            ],
            filename: 'members.ts',
        },
        {
            code: lines('declare module "x" { const a: number; }', 'export = {};'),
            errors: [at(1, 0), at(2, 0)],
            filename: 'module.d.ts',
        },
        {
            code: lines('export const View = () => <main>{/* note */}</main>;'),
            errors: [at(1, 0), at(1, 7), at(1, 32, 'empty')],
            filename: 'view.tsx',
        },
    ],
    valid: [
        lines('const one = 1;', 'function two() { return { a: 1 }; }', 'class Three { four = 4; }'),
        lines("import { b } from './b.js';", 'const c = b;'),
        { code: lines('const View = () => <main>{value}</main>;'), filename: 'view.tsx' },
    ],
});
