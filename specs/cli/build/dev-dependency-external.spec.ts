import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

function installedToolchain(workdir: string): void {
    const root = join(workdir, 'node_modules/toolchain');
    mkdirSync(root, { recursive: true });
    writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({
            exports: { './config': { default: './config.js', types: './config.d.ts' } },
            name: 'toolchain',
            type: 'module',
            version: '1.0.0',
        }),
    );
    writeFileSync(join(root, 'config.js'), 'export const defineConfig = (config) => config;\n');
    writeFileSync(
        join(root, 'config.d.ts'),
        'export declare function defineConfig<T>(config: T): T;\n',
    );
}

describe('dev dependency external', () => {
    test("leaves a published library's devDependency to its consumer, a subpath import included, in the code and in the declarations", async () => {
        // Given - a published library whose entry imports `toolchain/config`, a package it holds as a devDependency alone; the install is a stub under node_modules/, so the ground cannot be a fixture
        const result = await cli
            .fixture(directory('./__fixtures__/dev-dependency-lib/'))
            .prepare(installedToolchain)
            .exec('build');

        // Then - both outputs import the package rather than carry its code
        expect(result.exitCode).toBe(0);
        expect(result.file('dist/index.js').content).toContain('from "toolchain/config"');
        expect(result.file('dist/index.js').content).not.toContain('(config) => config');
        expect(result.file('dist/index.d.ts').content).toContain('from "toolchain/config"');
    });
});
