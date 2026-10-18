import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type { ResolveFnOutput, ResolveHookContext } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, onTestFinished, test } from 'vitest';

import { fromOwnSources, ownSourcesOf } from '../own-sources.js';

const NEXT: ResolveFnOutput = { url: 'next:' };

function tree(files: Readonly<Record<string, string>>): string {
    const made = mkdtempSync(join(tmpdir(), 'own-sources-'));
    const root = realpathSync(made);
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

const manifest = (exports: Readonly<Record<string, unknown>>): string =>
    JSON.stringify({ exports, name: '@scope/own' });

function resolvedBy(root: string, specifier: string, parent: string | undefined): string {
    const context: ResolveHookContext = {
        conditions: [],
        importAttributes: {},
        parentURL:
            parent === undefined || parent.includes(':')
                ? parent
                : pathToFileURL(join(root, parent)).href,
    };

    return fromOwnSources(root)(specifier, context, () => NEXT).url;
}

const urlOf = (root: string, path: string): string => pathToFileURL(join(root, path)).href;

describe('own-sources', () => {
    test('ownSourcesOf: each exported subpath is keyed by its specifier and read from its source, src/ before lint/', () => {
        // Given - a root export, a subpath under src/, one under lint/, one written in both, a browser condition, a pattern and a subpath with no source
        const root = tree({
            'lint/index.both.ts': '',
            'lint/index.rules.ts': '',
            'package.json': manifest({
                '.': './dist/index.js',
                './both': './dist/both.js',
                './config': './dist/config.js',
                './nowhere': './dist/nowhere.js',
                './rules': { browser: './dist/rules.browser.js', default: './dist/rules.js' },
                './tsconfig/*': './src/presets/tsconfig/*.json',
            }),
            'src/index.both.ts': '',
            'src/index.config.ts': '',
            'src/index.rules.browser.ts': '',
            'src/index.ts': '',
        });

        // Then - the node condition's source answers each, and a subpath with none is absent
        expect([...ownSourcesOf(root)]).toStrictEqual([
            ['@scope/own', join(root, 'src/index.ts')],
            ['@scope/own/both', join(root, 'src/index.both.ts')],
            ['@scope/own/config', join(root, 'src/index.config.ts')],
            ['@scope/own/rules', join(root, 'lint/index.rules.ts')],
        ]);
    });

    test("fromOwnSources: the package's own name resolves to its source, any other bare name to the next resolver", () => {
        // Given - a package exporting ./config from its source
        const root = tree({
            'package.json': manifest({ './config': './dist/config.js' }),
            'src/index.config.ts': '',
        });

        // Then - its own subpath short-circuits to the source, a subpath it does not export and another package do not
        expect(
            fromOwnSources(root)(
                '@scope/own/config',
                { conditions: [], importAttributes: {}, parentURL: undefined },
                () => NEXT,
            ),
        ).toStrictEqual({
            shortCircuit: true,
            url: urlOf(root, 'src/index.config.ts'),
        });
        expect(resolvedBy(root, '@scope/own/rules', 'src/index.config.ts')).toBe(NEXT.url);
        expect(resolvedBy(root, '@scope/other/config', 'src/index.config.ts')).toBe(NEXT.url);
    });

    test("fromOwnSources: a source's import of a .js no disk holds resolves to the .ts beside it", () => {
        // Given - a source importing a sibling written in TypeScript, a sibling built as .js, and one on no disk
        const root = tree({
            'lint/kit/built.js': '',
            'lint/kit/built.ts': '',
            'lint/kit/written.ts': '',
            'package.json': manifest({}),
        });

        // Then - only the sibling no .js stands for is read from its .ts; one of neither goes on
        expect(resolvedBy(root, './kit/written.js', 'lint/index.ts')).toBe(
            urlOf(root, 'lint/kit/written.ts'),
        );
        expect(resolvedBy(root, './kit/built.js', 'lint/index.ts')).toBe(NEXT.url);
        expect(resolvedBy(root, './kit/absent.js', 'lint/index.ts')).toBe(NEXT.url);
    });

    test.each([
        ['a parent under node_modules', './written.js', 'node_modules/dep/index.ts'],
        ['a built parent', './written.js', 'lint/index.js'],
        ['a parent outside the root its name prefixes', './written.js', 'SIBLING'],
        ['no parent', './written.js', undefined],
        ['a parent that is no file', './written.js', 'data:text/javascript,'],
        ['a bare name', 'written.js', 'lint/index.ts'],
        ['a .jsx', './view.jsx', 'lint/index.ts'],
    ])('fromOwnSources: %s goes to the next resolver', (_what, specifier, parent) => {
        // Given - a sibling written in TypeScript beside every parent, and one in a folder the root's name prefixes
        const root = tree({
            'lint/view.tsx': '',
            'lint/written.ts': '',
            'node_modules/dep/written.ts': '',
            'package.json': manifest({}),
        });
        mkdirSync(`${root}-sibling`);
        writeFileSync(`${root}-sibling/written.ts`, '');
        onTestFinished(() => {
            rmSync(`${root}-sibling`, { force: true, recursive: true });
        });
        const from = parent === 'SIBLING' ? pathToFileURL(`${root}-sibling/index.ts`).href : parent;

        // Then - the hook leaves it to Node
        expect(resolvedBy(root, specifier, from)).toBe(NEXT.url);
    });
});
