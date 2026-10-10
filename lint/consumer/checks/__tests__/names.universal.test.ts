import { describe, expect, test } from 'vitest';

import { findingsOf } from '../names.universal.js';
import type { Universal } from '../names.universal.js';

const UNIVERSAL: Universal = {
    constructs: new Set(['types']),
    grabBag: new Set(['tools']),
    lint: { consumer: [], kit: [], self: [] },
    memberRoots: new Set(),
    shortcuts: new Set(['auth', 'cfg']),
    spine: new Set(),
    toolRoots: {},
};

const judged = (...files: string[]): string[] =>
    findingsOf(files, UNIVERSAL).map(({ path, rule }) => `${rule} ${path}`);

describe('findingsOf', () => {
    test('judges every folder of a swept root and the file, down the whole path', () => {
        // Given - a swept root with a grab-bag folder, an abbreviated folder at depth and an abbreviated file
        // Then - a grab-bag folder and an abbreviated one at depth, and an abbreviated file, each named at its own place
        expect(judged('src/orders/tools/auth/cfg.ts')).toStrictEqual([
            'names/no-grab-bag-name src/orders/tools',
            'names/no-abbreviated-word src/orders/tools/auth',
            'names/no-abbreviated-word src/orders/tools/auth/cfg.ts',
        ]);
    });

    test('leaves a framework router to its URLs: the folders below `app/` are served names, the file is still judged', () => {
        // Given - a framework router folder and a plain folder of the same names
        // Then - `tools` below `app/` is a route, `app/` itself is judged and clean, and the file under it is judged by name
        expect(
            judged('src/app/tools/page.ts', 'src/app/tools/cfg.ts', 'src/tools/page.ts'),
        ).toStrictEqual([
            'names/no-abbreviated-word src/app/tools/cfg.ts',
            'names/no-grab-bag-name src/tools',
        ]);
    });

    test('leaves the folders below a specification to the product’s own words, and judges their files and every other specs folder', () => {
        // Given - a specification folder with a command folder, and the same names under other specs folders
        // Then - `auth` under specs/cli/ is a command, but a file of it is judged, and the same folder under another specs folder is judged
        expect(
            judged(
                'specs/cli/auth/login.spec.ts',
                'specs/cli/auth/cfg.spec.ts',
                'specs/orders/auth/login.spec.ts',
                'specs/cli/tools/deep/list.spec.ts',
            ),
        ).toStrictEqual([
            'names/no-abbreviated-word specs/cli/auth/cfg.spec.ts',
            'names/no-abbreviated-word specs/orders/auth',
        ]);
    });

    test('names a construct by its folder or by the suffix of its file', () => {
        // Given - a `types` folder and a `*.types.ts` file
        // Then - a `types` folder and a `*.types.ts` file are constructs of the language
        expect(judged('src/types/order.ts', 'src/order.types.ts')).toStrictEqual([
            'names/no-language-construct-name src/order.types.ts',
            'names/no-language-construct-name src/types',
        ]);
    });
});
