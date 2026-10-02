import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('oxfmt', () => {
    test('a consumer config handing oxfmt the installed preset formats the project to the estate style, and leaves its ground as written', async () => {
        // Given - a consumer's project whose oxfmt.config.ts hands oxfmt the preset, a module written in another style, and ground a spec stands on
        const result = await cli.fixture(directory('./_fixtures/formatting/')).exec('oxfmt');

        // Then - four spaces, single quotes, 100 columns, trailing commas, imports and classes sorted, package.json keys in order; the ground untouched
        expect(result.exitCode).toBe(0);
        expect(result.file('src/index.ts').content).toBe(
            [
                "import { clsx } from 'clsx';",
                "import { readFileSync } from 'node:fs';",
                "import { join } from 'node:path';",
                '',
                "import { greet } from './greet.js';",
                '',
                "export const card = clsx('flex bg-white p-4 text-sm');",
                "export const message = greet(readFileSync(join('data', 'name.txt'), 'utf8'), {",
                "    punctuation: '!',",
                '    uppercase: false,',
                '});',
                'export function shout(text: string) {',
                '    return text.toUpperCase();',
                '}',
                '',
            ].join('\n'),
        );
        expect(result.file('package.json').content).toBe(
            [
                '{',
                '    "name": "formatting",',
                '    "version": "1.0.0",',
                '    "private": true,',
                '    "type": "module",',
                '    "devDependencies": {',
                '        "@jterrazz/typescript": "11.0.0"',
                '    }',
                '}',
                '',
            ].join('\n'),
        );
        expect(result.file('src/_fixtures/held.ts').content).toBe(
            'export const held = "byte for byte"\n',
        );
        expect(result.file('src/_expected/held.ts').content).toBe(
            'export const held = "byte for byte"\n',
        );
    });
});
