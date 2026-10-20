import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

function installed(workdir: string, path: string, manifest: object, declarations: string): void {
    mkdirSync(join(workdir, path), { recursive: true });
    writeFileSync(join(workdir, path, 'package.json'), JSON.stringify(manifest));
    writeFileSync(join(workdir, path, 'index.d.ts'), declarations);
}

describe('unnameable declarations', () => {
    test('refuses to build a library whose inferred export names a type only a dependency of its dependency resolves, and publishes no declaration of it', async () => {
        // Given - a library exporting what `dep-a` returns, a type of the `dep-b` nested under `dep-a`; the install is stubs under node_modules/, so the ground cannot be a fixture
        const result = await cli
            .fixture(directory('./__fixtures__/unnameable-lib/'))
            .prepare((workdir) => {
                installed(
                    workdir,
                    'node_modules/dep-a',
                    {
                        dependencies: { 'dep-b': '1.0.0' },
                        name: 'dep-a',
                        types: 'index.d.ts',
                        version: '1.0.0',
                    },
                    "import type { Thing } from 'dep-b';\nexport declare function make(): Thing;\n",
                );
                installed(
                    workdir,
                    'node_modules/dep-a/node_modules/dep-b',
                    { name: 'dep-b', types: 'index.d.ts', version: '1.0.0' },
                    'export interface Thing { readonly id: string }\n',
                );
            })
            .exec('build');

        // Then - the declaration emit names both exports a consumer could not resolve, and no dist/ is written
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain(
            "src/index.ts(3,14): error TS2883: The inferred type of 'made' cannot be named without a reference to 'Thing' from 'dep-a/node_modules/dep-b'. This is likely not portable. A type annotation is necessary.",
        );
        expect(result.stderr.text).toContain(
            "src/index.ts(5,17): error TS2883: The inferred type of 'remade' cannot be named without a reference to 'Thing' from 'dep-a/node_modules/dep-b'. This is likely not portable. A type annotation is necessary.",
        );
        expect(result.file('dist/index.d.ts').exists).toBe(false);
    });
});
