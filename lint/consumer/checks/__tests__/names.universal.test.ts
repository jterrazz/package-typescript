import { describe, expect, test } from 'vitest';

import { findingsOf } from '../names.universal.js';
import type { Universal } from '../names.universal.js';

const UNIVERSAL: Universal = {
    constructs: new Set(['types']),
    grabBag: new Set(['tools']),
    lint: { consumer: [], kit: [], self: [] },
    memberRoots: new Set(),
    shortcuts: new Set(['auth', 'cfg']),
    specifications: new Set(['cli', 'website']),
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

    test('leaves the folders on the path of a spec to the product’s own words, and judges their files and every other folder', () => {
        // Given - a specification folder with command folders holding specs, and the same names under another specs folder
        // Then - `auth` and `tools` on the path of a spec under specs/cli/ are a command's, a file of them is judged, and the same folders under another specs folder are judged
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

    test('judges what no spec stands on below a specification: helper folders, and everything below a double-underscore folder', () => {
        // Given - a folder holding only helpers, a setup folder with a grab-bag folder, a fixtures folder, and a subject folder beside them holding a spec
        // Then - the helper folder, the folder under __setup__ and the one under the website's __fixtures__ are judged; the subject folder of the spec is not
        expect(
            judged(
                'specs/cli/tools/helper.ts',
                'specs/cli/__setup__/tools/seed.ts',
                'specs/website/__fixtures__/tools/page.ts',
                'specs/cli/auth/login.spec.ts',
                'specs/website/auth/login.spec.ts',
                'specs/website/auth/__fixtures__/tools/page.ts',
            ),
        ).toStrictEqual([
            'names/no-grab-bag-name specs/cli/__setup__/tools',
            'names/no-grab-bag-name specs/cli/tools',
            'names/no-grab-bag-name specs/website/__fixtures__/tools',
            'names/no-grab-bag-name specs/website/auth/__fixtures__/tools',
        ]);
    });

    test('exempts no specs folder when the project declares no specification', () => {
        // Given - a project whose test section names no specification
        const none = findingsOf(['specs/cli/auth/login.spec.ts'], {
            ...UNIVERSAL,
            specifications: new Set(),
        }).map(({ path, rule }) => `${rule} ${path}`);

        // Then - the folder is judged like any other
        expect(none).toStrictEqual(['names/no-abbreviated-word specs/cli/auth']);
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
