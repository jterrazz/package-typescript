import { ruleTester } from '@jterrazz/test';

import { promiseIsAwaited } from '../promise-is-awaited.js';

const lines = (...text: string[]): string => text.join('\n');

ruleTester().run('promise-is-awaited', promiseIsAwaited, {
    invalid: [
        {
            code: 'export const length = fetch(url).then((response) => response.status);',
            errors: [{ column: 22, data: { method: 'then' }, line: 1, messageId: 'chained' }],
        },
        {
            code: lines(
                'export async function load(task) {',
                '    const settled = task.catch(() => null).finally(stop);',
                '    return settled;',
                '}',
            ),
            errors: [
                { column: 20, data: { method: 'finally' }, line: 2, messageId: 'chained' },
                { column: 20, data: { method: 'catch' }, line: 2, messageId: 'chained' },
            ],
        },
        {
            code: 'main().catch(String);',
            errors: [{ column: 0, data: { method: 'catch' }, line: 1, messageId: 'chained' }],
        },
        {
            code: lines('let fallback = 0;', 'export const count = read().catch(fallback);'),
            errors: [{ column: 21, data: { method: 'catch' }, line: 2, messageId: 'chained' }],
        },
        {
            code: lines(
                'const fallback = 0;',
                'const fallback2 = () => 0;',
                'export const count = read().catch(fallback2);',
            ),
            errors: [{ column: 21, data: { method: 'catch' }, line: 3, messageId: 'chained' }],
        },
        {
            code: 'export const both = read().then(1);',
            errors: [{ column: 20, data: { method: 'then' }, line: 1, messageId: 'chained' }],
        },
        {
            code: lines(
                'export async function each(items) {',
                '    await Promise.all(items.map(async (item) => {',
                '        const done = item.then(String);',
                '        return done;',
                '    }));',
                '}',
            ),
            errors: [{ column: 21, data: { method: 'then' }, line: 3, messageId: 'chained' }],
        },
        {
            code: 'export const count = read().catch();',
            errors: [{ column: 21, data: { method: 'catch' }, line: 1, messageId: 'chained' }],
        },
        {
            code: "export const count = read().catch('x', 'y');",
            errors: [{ column: 21, data: { method: 'catch' }, line: 1, messageId: 'chained' }],
        },
        {
            code: 'export const count = read().catch(fallbackOf());',
            errors: [{ column: 21, data: { method: 'catch' }, line: 1, messageId: 'chained' }],
        },
        {
            code: lines(
                'const fallback = 0;',
                'export function scoped() {',
                '    const fallback = () => 1;',
                '    return fallback;',
                '}',
                'export const count = read().catch(fallback);',
            ),
            errors: [{ column: 21, data: { method: 'catch' }, line: 6, messageId: 'chained' }],
        },
        {
            code: lines(
                'const first = second;',
                'const second = first;',
                'export const count = read().catch(first);',
            ),
            errors: [{ column: 21, data: { method: 'catch' }, line: 3, messageId: 'chained' }],
        },
        {
            code: lines(
                'const { fallback } = settings;',
                'export const count = read().catch(fallback);',
            ),
            errors: [{ column: 21, data: { method: 'catch' }, line: 2, messageId: 'chained' }],
        },
        {
            code: lines(
                'declare const fallback: string;',
                'export const count = read().catch(fallback);',
            ),
            errors: [{ column: 21, data: { method: 'catch' }, line: 2, messageId: 'chained' }],
            filename: '/nowhere/src/count.ts',
        },
        {
            code: 'export const done = (async () => 1)().then(String);',
            errors: [{ column: 20, data: { method: 'then' }, line: 1, messageId: 'chained' }],
        },
        {
            code: lines('void (async () => {', '    await main();', '})();'),
            errors: [{ column: 0, line: 1, messageId: 'iife' }],
        },
        {
            code: lines('(async function start() {', '    await main();', '})();'),
            errors: [{ column: 0, line: 1, messageId: 'iife' }],
        },
    ],
    valid: [
        lines(
            'export async function settle(task, stop) {',
            '    return await Promise.race([task.then(() => true), stop.catch(() => false)]);',
            '}',
        ),
        lines(
            'export async function load(handle) {',
            '    const reason = await handle.open().then(String);',
            '    return reason;',
            '}',
        ),
        "export const name = z.string().catch('anonymous');",
        lines(
            'const absent = undefined;',
            'export const flag = z.boolean().optional().catch(absent);',
        ),
        {
            code: lines(
                "const DEFAULTS = { language: 'en' } as const;",
                'const fallback = DEFAULTS;',
                'export const settings = schema.catch(fallback satisfies object);',
            ),
            filename: '/nowhere/src/settings.ts',
        },
        'export const tags = z.array(z.string()).catch([]);',
        'export const label = z.string().catch(`none`);',
        'export const total = z.number().catch(1 + 1);',
        {
            code: "export const named = z.string().catch('x' as string);",
            filename: '/nowhere/src/named.ts',
        },
        {
            code: "export const typed = z.string().catch('x' satisfies string);",
            filename: '/nowhere/src/typed.ts',
        },
        'export const at = z.number().catch(-1);',
        'export const at = z.date().catch(new Date(0));',
        lines(
            'export async function read(task) {',
            '    return await task.catch(() => null);',
            '}',
        ),
        lines(
            'export function read(task) {',
            '    return task.then((value) => value.length);',
            '}',
        ),
        'export const lazy = (task) => task.then((value) => value.length);',
        lines('export function* steps(task) {', '    yield task.then(String);', '}'),
        "export const value = record['then'](1);",
        'export const value = record[then](String);',
        'export const made = new registry.then(String);',
        lines(
            'export class Task {',
            '    #then(next) {',
            '        return next;',
            '    }',
            '    run() {',
            '        const done = this.#then(String);',
            '        return done;',
            '    }',
            '}',
        ),
        'export const value = schema.catch(undefined);',
        "export const value = schema.catch(('x'));",
        'export const value = map.get(key);',
        lines('export async function start() {', '    await main();', '}', 'await start();'),
        lines('(() => {', '    run();', '})();'),
        lines(
            'export function later() {',
            '    void (async () => {',
            '        await main();',
            '    })();',
            '}',
        ),
    ],
});
