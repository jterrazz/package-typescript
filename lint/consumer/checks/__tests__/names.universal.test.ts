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

    test('a name loses a leading underscore only, and a construct is named by a suffix that sits between the stem and the extension', () => {
        // Given - a grab-bag word split by an inner underscore, and a file named for the suffix alone, with no construct on the roster
        const bare: Universal = { ...UNIVERSAL, constructs: new Set() };

        // Then - `to_ols` is not `tools`, and `types.ts` holds no suffix before its extension
        expect([judged('src/to_ols/a.ts'), findingsOf(['src/types.ts'], bare)]).toStrictEqual([
            [],
            [],
        ]);
    });

    test('a spec file is a .spec.ts, .spec.tsx, .spec.yaml or .spec.yml and ends there; a router root ends the walk one level in wherever it stands', () => {
        // Given - a command folder of each spec extension, and a look-alike, with each folder's name a shortcut; and a router root below a grab-bag folder
        const universal: Universal = {
            ...UNIVERSAL,
            shortcuts: new Set(['aa', 'bb', 'cc', 'dd', 'ee']),
        };
        const found = findingsOf(
            [
                'specs/cli/aa/a.spec.ts',
                'specs/cli/bb/b.spec.tsx',
                'specs/cli/cc/c.spec.yaml',
                'specs/cli/dd/d.spec.yml',
                'specs/cli/ee/e.spec.tsx.old',
                'src/tools/app/orders/page.ts',
            ],
            universal,
        ).map(({ path, rule }) => `${rule} ${path}`);

        // Then - only the look-alike's folder and the folder above the router root are judged
        expect(found).toStrictEqual([
            'names/no-abbreviated-word specs/cli/ee',
            'names/no-grab-bag-name src/tools',
        ]);
    });

    test('a specification folder is read at the root of specs/ alone, a __ folder ends the subjects, and a root file or a folder outside the swept roots is no subject', () => {
        // Given - a specification name under src/, a folder opening on two underscores below a specification, a file named for a swept root, and a docs folder
        const found = judged(
            'src/cli/auth/login.spec.ts',
            'specs/cli/__setup/auth/login.spec.ts',
            'docs/tools/page.md',
        );

        // Then - the folder under src/ and the one below the __ folder are judged; the docs folder is no business of the sweep
        expect(found).toStrictEqual([
            'names/no-abbreviated-word specs/cli/__setup/auth',
            'names/no-abbreviated-word src/cli/auth',
        ]);
    });

    test('a file named for a swept root, alone at the root of the project, is not swept', () => {
        // Given - a roster holding a swept root's name
        const universal: Universal = { ...UNIVERSAL, grabBag: new Set(['lib']) };

        // Then - the file `lib` is no folder, and a folder of that name below the root is
        expect([
            findingsOf(['lib'], universal).length,
            findingsOf(['src/lib/a.ts'], universal).length,
        ]).toStrictEqual([0, 1]);
    });

    test('findingsOf — each finding carries its whole lesson, at the first line of its path', () => {
        // Given - a marked folder restating its mark, a grab-bag folder, a construct file and folder, and an abbreviated file
        const found = findingsOf(
            [
                'src/_Shared/a.ts',
                'src/tools/x.ts',
                'src/order.types.ts',
                'src/types/y.ts',
                'src/cfg.ts',
            ],
            UNIVERSAL,
        );

        // Then - each rule's found, why, fix and read, the construct file named by its whole file name
        const read = 'read: docs/reference/quality-checks.md#the-names-tree-pass';
        const grabBag =
            'why: A directory or file is named for the subject it holds, never a grab-bag word.';
        const construct =
            'why: A directory or file is named for its subject, never for a construct of the language. · fix: name it for the subject it holds';
        expect(found).toStrictEqual([
            {
                column: 1,
                line: 1,
                message: `found: \`_Shared\` names no subject: its \`_\` already says the row shares it, and the word says it again · ${grabBag} · fix: name it for what its files share (\`_taxonomy/\`, never \`_shared/\`), or move a lone file beside the code that uses it · ${read}`,
                path: 'src/_Shared',
                rule: 'names/no-grab-bag-name',
            },
            {
                column: 1,
                line: 1,
                message: `found: \`cfg\` is a word written in half · why: Every word of a name is spelled whole. · fix: spell every word of it whole · ${read}`,
                path: 'src/cfg.ts',
                rule: 'names/no-abbreviated-word',
            },
            {
                column: 1,
                line: 1,
                message: `found: \`order.types.ts\` names a construct of the language · ${construct} · ${read}`,
                path: 'src/order.types.ts',
                rule: 'names/no-language-construct-name',
            },
            {
                column: 1,
                line: 1,
                message: `found: \`tools\` names no subject: it holds whatever nobody placed · ${grabBag} · fix: name it for the subject it holds, or move what it holds beside the code that uses it · ${read}`,
                path: 'src/tools',
                rule: 'names/no-grab-bag-name',
            },
            {
                column: 1,
                line: 1,
                message: `found: \`types\` names a construct of the language · ${construct} · ${read}`,
                path: 'src/types',
                rule: 'names/no-language-construct-name',
            },
        ]);
    });

    test('findingsOf — a folder marked `_` that says `shared` restates its mark outside a specs tree only, and a plain `shared` is a word like any', () => {
        // Given - marked and plain `shared` folders in a source root and under specs
        // Then - the marked one in src/ alone, its case aside
        expect(
            judged(
                'src/_shared/a.ts',
                'src/_SHARED/b.ts',
                'src/shared/c.ts',
                'src/x_shared/d.ts',
                'specs/_shared/e.ts',
                'src/_taxonomy/f.ts',
            ),
        ).toStrictEqual([
            'names/no-grab-bag-name src/_SHARED',
            'names/no-grab-bag-name src/_shared',
        ]);
    });

    test('findingsOf — a name is abbreviated when any one of its hyphenated words is', () => {
        // Given - a folder whose second word is a shortcut, and one with none
        // Then - the first alone
        expect(judged('src/order-cfg/a.ts', 'src/order-config/b.ts')).toStrictEqual([
            'names/no-abbreviated-word src/order-cfg',
        ]);
    });

    test.each(['apps', 'bin', 'lib', 'lint', 'packages', 'specs', 'src', 'tests'])(
        'findingsOf — %s/ is swept, its own name never judged',
        (root) => {
            // Given - a grab-bag folder below the root, and a roster that would refuse the root's own name
            const universal: Universal = { ...UNIVERSAL, grabBag: new Set(['tools', root]) };

            // Then - the folder below it alone
            expect(
                findingsOf([`${root}/tools/a.ts`], universal).map(
                    ({ path, rule }) => `${rule} ${path}`,
                ),
            ).toStrictEqual([`names/no-grab-bag-name ${root}/tools`]);
        },
    );
});
