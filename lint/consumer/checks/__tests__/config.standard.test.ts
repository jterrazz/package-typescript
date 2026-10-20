import { describe, expect, test } from 'vitest';

import type { Context } from '../../../kit/checker/pass.js';
import { standardLogic } from '../config.standard.js';

function noValue(flag: string): string | undefined;
function noValue(flag: string, fallback: string): string;
function noValue(_flag: string, fallback?: string): string | undefined {
    return fallback;
}

function contextOver(files: Readonly<Record<string, string>>): Context {
    const root = '/repo';
    const inside = (path: string): string => path.slice(root.length + 1);

    return {
        config: async () => await Promise.reject(new Error('no settings are read here')),
        exists: (path) => inside(path) in files,
        files: () => Object.keys(files),
        fix: false,
        has: () => false,
        list: (directory) => {
            const prefix = `${inside(directory)}/`;
            const names = Object.keys(files)
                .filter((path) => path.startsWith(prefix))
                .map((path) => String(path.slice(prefix.length).split('/')[0]));

            return names.length === 0 ? null : [...new Set(names)];
        },
        positionals: [],
        read: (path) => files[inside(path)] ?? null,
        root,
        value: noValue,
        verbatim: async () => await Promise.resolve([]),
    };
}

const where = (found: readonly { message: string }[]): string[] =>
    found.map(({ message }) => message.split(' · ')[0] ?? '');

describe('config.standard', () => {
    test('standardLogic — a member’s standard is read under the member, and a unit that keeps none reads nothing', async () => {
        // Given - a monorepo whose member keeps a standard module that computes, and whose root keeps none
        const context = contextOver({
            'packages/a/src/standard/rules.ts': 'export const limit = 1 + 1;\n',
            'src/index.ts': 'export const root = 1 + 1;\n',
        });

        // Then - the member's computation is found at its place, and the root holds no standard to read
        expect({
            member: where(await standardLogic(context, 'packages/a')),
            root: await standardLogic(context, '.'),
        }).toStrictEqual({
            member: ['found: packages/a/src/standard/rules.ts:1 holds an operation'],
            root: [],
        });
    });
});
